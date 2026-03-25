import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const pool = createPool({ connectionString });

  try {
    // 1. Crear tablas si no existen
    await pool.sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        items JSONB NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.sql`
      CREATE TABLE IF NOT EXISTS draft_order (
        id INT PRIMARY KEY DEFAULT 1,
        items JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const { type } = request.query;

    // 2. GET: Listar historial o Borrador
    if (request.method === 'GET') {
      if (type === 'draft') {
        const { rows } = await pool.sql`SELECT items FROM draft_order WHERE id = 1;`;
        return response.status(200).json(rows[0]?.items || []);
      }
      const { rows } = await pool.sql`SELECT * FROM orders ORDER BY created_at DESC;`;
      return response.status(200).json(rows || []);
    }

    // 3. POST: Guardar nuevo pedido o Borrador
    if (request.method === 'POST') {
      const { items, total_price } = request.body;
      
      if (type === 'draft') {
        // Upsert para el borrador del admin (siempre id=1)
        await pool.sql`
          INSERT INTO draft_order (id, items, updated_at)
          VALUES (1, ${JSON.stringify(items)}, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, updated_at = CURRENT_TIMESTAMP;
        `;
        return response.status(200).json({ message: 'Borrador guardado' });
      }

      const result = await pool.sql`
        INSERT INTO orders (items, total_price)
        VALUES (${JSON.stringify(items)}, ${total_price})
        RETURNING *;
      `;
      // Al finalizar un pedido real, limpiamos el borrador
      await pool.sql`UPDATE draft_order SET items = '[]' WHERE id = 1;`;
      
      return response.status(201).json(result.rows[0]);
    }

    // 4. DELETE: Borrar pedido del historial
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.sql`DELETE FROM orders WHERE id = ${id};`;
      return response.status(200).json({ message: 'Pedido eliminado' });
    }

    return response.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
