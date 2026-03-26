import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const pool = createPool({ connectionString });

  try {
    // 1. Crear/Actualizar Tabla
    await pool.sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'stock',
        category VARCHAR(50) DEFAULT 'Adulto',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Aseguramos columnas necesarias
    try { await pool.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'stock';`; } catch (e) {}
    try { await pool.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Adulto';`; } catch (e) {}
    try { await pool.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;`; } catch (e) {}
    try { await pool.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS short_id VARCHAR(10);`; } catch (e) {}

    // Migración para short_id si está vacío
    try {
      await pool.sql`
        UPDATE products 
        SET short_id = LPAD(id::text, 4, '0') 
        WHERE short_id IS NULL OR short_id = '';
      `;
    } catch (e) { console.error("Error migración ID:", e); }

    // 2. GET
    if (request.method === 'GET') {
      const { test } = request.query;
      if (test === 'true') {
        const mockData = await import('./mock_products.json', { assert: { type: 'json' } });
        return response.status(200).json(mockData.default || []);
      }
      const { rows } = await pool.sql`SELECT * FROM products ORDER BY created_at DESC;`;
      return response.status(200).json(rows || []);
    }

    // 3. POST (Crear)
    if (request.method === 'POST') {
      const { name, size, price, imageURL, type, category, is_favorite, short_id } = request.body;
      const result = await pool.sql`
        INSERT INTO products (name, size, price, image_url, type, category, is_favorite, short_id)
        VALUES (${name}, ${size}, ${price}, ${imageURL}, ${type || 'stock'}, ${category || 'Adulto'}, ${is_favorite || false}, ${short_id || ''})
        RETURNING *;
      `;
      return response.status(201).json(result.rows[0]);
    }

    // 4. PUT (Actualizar)
    if (request.method === 'PUT') {
      const { id, name, size, price, imageURL, type, category, is_favorite, short_id } = request.body;
      const result = await pool.sql`
        UPDATE products 
        SET name = ${name}, size = ${size}, price = ${price}, image_url = ${imageURL}, type = ${type}, category = ${category}, is_favorite = ${is_favorite}, short_id = ${short_id}
        WHERE id = ${id}
        RETURNING *;
      `;
      return response.status(200).json(result.rows[0]);
    }

    // 5. DELETE
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.sql`DELETE FROM products WHERE id = ${id};`;
      return response.status(200).json({ message: 'Producto eliminado' });
    }

    return response.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
