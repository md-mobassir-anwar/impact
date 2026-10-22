import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { getDb } from '../database';
import { Order, CreateOrderInput, UpdateOrderInput, OrderPriority } from '../models/types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const VALID_PRIORITIES: OrderPriority[] = ['low', 'normal', 'high', 'urgent'];

/**
 * Validates order input fields.
 */
function validateOrderInput(input: any): { valid: boolean; error?: string } {
  if (!input.customer_name || typeof input.customer_name !== 'string' || input.customer_name.trim() === '') {
    return { valid: false, error: 'customer_name is required' };
  }
  if (!input.delivery_address || typeof input.delivery_address !== 'string' || input.delivery_address.trim() === '') {
    return { valid: false, error: 'delivery_address is required' };
  }
  if (input.latitude === undefined || input.latitude === null || typeof Number(input.latitude) !== 'number' || isNaN(Number(input.latitude))) {
    return { valid: false, error: 'latitude must be a valid number' };
  }
  const lat = Number(input.latitude);
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'latitude must be between -90 and 90' };
  }

  if (input.longitude === undefined || input.longitude === null || typeof Number(input.longitude) !== 'number' || isNaN(Number(input.longitude))) {
    return { valid: false, error: 'longitude must be a valid number' };
  }
  const lon = Number(input.longitude);
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'longitude must be between -180 and 180' };
  }

  if (input.package_weight !== undefined) {
    const weight = Number(input.package_weight);
    if (isNaN(weight) || weight <= 0) {
      return { valid: false, error: 'package_weight must be a positive number greater than 0' };
    }
  }

  if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
    return { valid: false, error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` };
  }

  if (input.deadline) {
    const d = new Date(input.deadline);
    if (isNaN(d.getTime())) {
      return { valid: false, error: 'deadline must be a valid ISO date string' };
    }
  }

  if (input.time_window_start && input.time_window_end) {
    // If both provided as times or dates, start shouldn't be after end
    const d1 = new Date(input.time_window_start).getTime();
    const d2 = new Date(input.time_window_end).getTime();
    if (!isNaN(d1) && !isNaN(d2) && d1 > d2) {
      return { valid: false, error: 'time_window_start cannot be after time_window_end' };
    }
  }

  return { valid: true };
}

// GET /api/orders
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const {
      status,
      priority,
      search,
      assigned_agent_id,
      sort_by = 'created_at',
      sort_order = 'desc',
      page = '1',
      page_size = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(page_size as string, 10) || 50));
    const offset = (pageNum - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }
    if (assigned_agent_id) {
      conditions.push('assigned_agent_id = ?');
      params.push(assigned_agent_id);
    }
    if (search) {
      conditions.push('(customer_name LIKE ? OR delivery_address LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Allowed sort columns
    const allowedSortColumns: Record<string, string> = {
      created_at: 'created_at',
      updated_at: 'updated_at',
      customer_name: 'customer_name',
      priority: 'priority',
      status: 'status',
      package_weight: 'package_weight',
      deadline: 'deadline',
    };

    const sortByCol = allowedSortColumns[sort_by as string] || 'created_at';
    const direction = (sort_order as string).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count total
    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`)
      .get(...params) as { total: number };

    // Select paginated items
    const orders = db
      .prepare(
        `SELECT * FROM orders ${whereClause} ORDER BY ${sortByCol} ${direction} LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Order[];

    res.json({
      orders,
      total: countRow.total,
      page: pageNum,
      pageSize: limit,
      totalPages: Math.ceil(countRow.total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve orders', details: err.message });
  }
});

// GET /api/orders/export/csv
router.get('/export/csv', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

    const csvData = csvStringify(orders, {
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'customer_name', header: 'Customer Name' },
        { key: 'delivery_address', header: 'Delivery Address' },
        { key: 'latitude', header: 'Latitude' },
        { key: 'longitude', header: 'Longitude' },
        { key: 'package_weight', header: 'Weight (kg)' },
        { key: 'priority', header: 'Priority' },
        { key: 'status', header: 'Status' },
        { key: 'assigned_agent_id', header: 'Assigned Agent' },
        { key: 'deadline', header: 'Deadline' },
        { key: 'time_window_start', header: 'Time Window Start' },
        { key: 'time_window_end', header: 'Time Window End' },
        { key: 'service_duration', header: 'Duration (mins)' },
        { key: 'special_instructions', header: 'Instructions' },
        { key: 'created_at', header: 'Created At' },
      ],
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="routewise_orders.csv"');
    res.status(200).send(csvData);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export orders to CSV', details: err.message });
  }
});

// POST /api/orders/import/csv
router.post('/import/csv', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'CSV file is required (form field: file)' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];

    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT INTO orders (
        id, customer_name, delivery_address, latitude, longitude,
        package_weight, service_duration, priority, time_window_start,
        time_window_end, deadline, status, assigned_agent_id,
        special_instructions, created_at, updated_at, is_demo_data
      ) VALUES (
        @id, @customer_name, @delivery_address, @latitude, @longitude,
        @package_weight, @service_duration, @priority, @time_window_start,
        @time_window_end, @deadline, 'pending', NULL,
        @special_instructions, datetime('now'), datetime('now'), 0
      )
    `);

    let createdCount = 0;
    const errors: { row: number; error: string }[] = [];

    const tx = db.transaction(() => {
      records.forEach((row, idx) => {
        const orderData = {
          customer_name: row.customer_name || row['Customer Name'],
          delivery_address: row.delivery_address || row['Delivery Address'],
          latitude: parseFloat(row.latitude || row['Latitude']),
          longitude: parseFloat(row.longitude || row['Longitude']),
          package_weight: parseFloat(row.package_weight || row['Weight (kg)'] || '1.0'),
          service_duration: parseInt(row.service_duration || row['Duration (mins)'] || '10', 10),
          priority: (row.priority || row['Priority'] || 'normal').toLowerCase(),
          time_window_start: row.time_window_start || row['Time Window Start'] || null,
          time_window_end: row.time_window_end || row['Time Window End'] || null,
          deadline: row.deadline || row['Deadline'] || null,
          special_instructions: row.special_instructions || row['Instructions'] || null,
        };

        const validation = validateOrderInput(orderData);
        if (!validation.valid) {
          errors.push({ row: idx + 2, error: validation.error || 'Validation error' });
          return;
        }

        insertStmt.run({
          id: uuidv4(),
          customer_name: orderData.customer_name,
          delivery_address: orderData.delivery_address,
          latitude: orderData.latitude,
          longitude: orderData.longitude,
          package_weight: orderData.package_weight,
          service_duration: orderData.service_duration,
          priority: orderData.priority,
          time_window_start: orderData.time_window_start,
          time_window_end: orderData.time_window_end,
          deadline: orderData.deadline,
          special_instructions: orderData.special_instructions,
        });
        createdCount++;
      });
    });

    tx();

    res.status(200).json({
      message: `Imported ${createdCount} orders`,
      created: createdCount,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to parse CSV file', details: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order | undefined;

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve order', details: err.message });
  }
});

// POST /api/orders
router.post('/', (req: Request, res: Response): void => {
  try {
    const validation = validateOrderInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    const newOrder: Order = {
      id,
      customer_name: req.body.customer_name.trim(),
      delivery_address: req.body.delivery_address.trim(),
      latitude: Number(req.body.latitude),
      longitude: Number(req.body.longitude),
      package_weight: req.body.package_weight !== undefined ? Number(req.body.package_weight) : 1.0,
      package_length: req.body.package_length !== undefined ? Number(req.body.package_length) : null,
      package_width: req.body.package_width !== undefined ? Number(req.body.package_width) : null,
      package_height: req.body.package_height !== undefined ? Number(req.body.package_height) : null,
      service_duration: req.body.service_duration !== undefined ? Number(req.body.service_duration) : 10,
      priority: req.body.priority || 'normal',
      time_window_start: req.body.time_window_start || null,
      time_window_end: req.body.time_window_end || null,
      deadline: req.body.deadline || null,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: req.body.special_instructions || null,
      created_at: now,
      updated_at: now,
      is_demo_data: req.body.is_demo_data ? 1 : 0,
    };

    db.prepare(`
      INSERT INTO orders (
        id, customer_name, delivery_address, latitude, longitude,
        package_weight, package_length, package_width, package_height,
        service_duration, priority, time_window_start, time_window_end,
        deadline, status, assigned_agent_id, special_instructions,
        created_at, updated_at, is_demo_data
      ) VALUES (
        @id, @customer_name, @delivery_address, @latitude, @longitude,
        @package_weight, @package_length, @package_width, @package_height,
        @service_duration, @priority, @time_window_start, @time_window_end,
        @deadline, @status, @assigned_agent_id, @special_instructions,
        @created_at, @updated_at, @is_demo_data
      )
    `).run(newOrder);

    res.status(201).json(newOrder);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

// POST /api/orders/bulk
router.post('/bulk', (req: Request, res: Response): void => {
  try {
    const ordersInput = req.body.orders || req.body;
    if (!Array.isArray(ordersInput)) {
      res.status(400).json({ error: 'Expected an array of orders in request body' });
      return;
    }

    const db = getDb();
    let createdCount = 0;
    const errors: { index: number; error: string }[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO orders (
        id, customer_name, delivery_address, latitude, longitude,
        package_weight, package_length, package_width, package_height,
        service_duration, priority, time_window_start, time_window_end,
        deadline, status, assigned_agent_id, special_instructions,
        created_at, updated_at, is_demo_data
      ) VALUES (
        @id, @customer_name, @delivery_address, @latitude, @longitude,
        @package_weight, @package_length, @package_width, @package_height,
        @service_duration, @priority, @time_window_start, @time_window_end,
        @deadline, 'pending', NULL, @special_instructions,
        datetime('now'), datetime('now'), @is_demo_data
      )
    `);

    const tx = db.transaction(() => {
      ordersInput.forEach((item: any, idx: number) => {
        const val = validateOrderInput(item);
        if (!val.valid) {
          errors.push({ index: idx, error: val.error || 'Invalid order' });
          return;
        }

        insertStmt.run({
          id: uuidv4(),
          customer_name: item.customer_name.trim(),
          delivery_address: item.delivery_address.trim(),
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          package_weight: item.package_weight !== undefined ? Number(item.package_weight) : 1.0,
          package_length: item.package_length || null,
          package_width: item.package_width || null,
          package_height: item.package_height || null,
          service_duration: item.service_duration !== undefined ? Number(item.service_duration) : 10,
          priority: item.priority || 'normal',
          time_window_start: item.time_window_start || null,
          time_window_end: item.time_window_end || null,
          deadline: item.deadline || null,
          special_instructions: item.special_instructions || null,
          is_demo_data: item.is_demo_data ? 1 : 0,
        });
        createdCount++;
      });
    });

    tx();

    res.status(201).json({ created: createdCount, errors });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create orders in bulk', details: err.message });
  }
});

// PUT /api/orders/:id
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      res.status(409).json({ error: `Cannot modify an order that is already ${existing.status}` });
      return;
    }

    const validation = validateOrderInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const updated: Order = {
      ...existing,
      customer_name: req.body.customer_name !== undefined ? req.body.customer_name.trim() : existing.customer_name,
      delivery_address: req.body.delivery_address !== undefined ? req.body.delivery_address.trim() : existing.delivery_address,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : existing.latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : existing.longitude,
      package_weight: req.body.package_weight !== undefined ? Number(req.body.package_weight) : existing.package_weight,
      package_length: req.body.package_length !== undefined ? req.body.package_length : existing.package_length,
      package_width: req.body.package_width !== undefined ? req.body.package_width : existing.package_width,
      package_height: req.body.package_height !== undefined ? req.body.package_height : existing.package_height,
      service_duration: req.body.service_duration !== undefined ? Number(req.body.service_duration) : existing.service_duration,
      priority: req.body.priority !== undefined ? req.body.priority : existing.priority,
      time_window_start: req.body.time_window_start !== undefined ? req.body.time_window_start : existing.time_window_start,
      time_window_end: req.body.time_window_end !== undefined ? req.body.time_window_end : existing.time_window_end,
      deadline: req.body.deadline !== undefined ? req.body.deadline : existing.deadline,
      special_instructions: req.body.special_instructions !== undefined ? req.body.special_instructions : existing.special_instructions,
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE orders SET
        customer_name = @customer_name,
        delivery_address = @delivery_address,
        latitude = @latitude,
        longitude = @longitude,
        package_weight = @package_weight,
        package_length = @package_length,
        package_width = @package_width,
        package_height = @package_height,
        service_duration = @service_duration,
        priority = @priority,
        time_window_start = @time_window_start,
        time_window_end = @time_window_end,
        deadline = @deadline,
        special_instructions = @special_instructions,
        updated_at = @updated_at
      WHERE id = @id
    `).run(updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update order', details: err.message });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status !== 'pending') {
      res.status(409).json({
        error: `Only orders in 'pending' status can be deleted. Current status: ${existing.status}`,
      });
      return;
    }

    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ message: 'Order successfully deleted', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete order', details: err.message });
  }
});

// PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status !== 'pending' && existing.status !== 'assigned') {
      res.status(409).json({
        error: `Only 'pending' or 'assigned' orders can be cancelled. Current status: ${existing.status}`,
      });
      return;
    }

    db.prepare(`
      UPDATE orders
      SET status = 'cancelled', assigned_agent_id = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel order', details: err.message });
  }
});

export default router;
