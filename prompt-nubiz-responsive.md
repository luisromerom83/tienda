Por favor, aplica las siguientes mejoras de diseño responsivo (móvil) en el panel de administración. El objetivo es evitar que los elementos colapsen, se desborden creando scrolls horizontales o que desaparezcan por los lados en pantallas pequeñas.

Sigue estos 4 pasos exactos:

1. **En `package.json`:**
Agrega el script `"vercel": "vercel dev"` dentro de `"scripts"` para facilitar arrancar el proyecto incluyendo la carpeta de funciones `/api`.

2. **En la etiqueta `<style>` de `src/pages/AdminDashboard.jsx`, añade estas clases y Media Queries al final:**
```css
/* Responsive Layout Fixes */
.admin-page-container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; gap: 1rem; }
.tallas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 1rem; }
.customer-form { display: flex; gap: 1rem; margin-top: 1rem; }
@media (max-width: 768px) {
  .admin-page-container { padding: 1rem; overflow-x: hidden; }
  .admin-header { flex-direction: column; text-align: center; }
  .admin-header img { height: 50px !important; }
  .tabs { overflow-x: auto; white-space: nowrap; padding-bottom: 5px; flex-wrap: nowrap; }
  .tab-btn { padding: 0.8rem 1rem; font-size: 0.85rem; flex: 0 0 auto; }
  .glass { padding: 1.2rem !important; }
  .admin-grid { grid-template-columns: 1fr; }
  .tallas-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.5rem; }
  .tallas-grid .glass { padding: 0.5rem !important; }
  .tallas-grid input { padding: 0.2rem !important; font-size: 0.8rem; }
  .tallas-grid svg, .tallas-grid span { font-size: 0.75rem; }
  .floating-order, .floating-sale { width: 100%; padding: 1.5rem; }
  .toggle-btn { padding: 0.8rem 0.3rem !important; font-size: 0.8rem !important; }
  .customer-form { flex-direction: column; }
  .cart-item-grid { grid-template-columns: 1fr 1fr !important; gap: 1rem !important; }
  .order-item-grid { grid-template-columns: 1fr 1fr !important; gap: 1rem !important; }
}
.cart-item-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 0.5rem; align-items: end; }
.cart-item-grid input, .cart-item-grid select { min-width: 0; width: 100%; }
.order-item-grid { display: grid; grid-template-columns: 1fr 1.5fr 1.5fr; gap: 0.5rem; align-items: end; }
.order-item-grid input, .order-item-grid select { min-width: 0; width: 100%; }
```

3. **En `src/pages/AdminDashboard.jsx` sustituye las etiquetas genéricas (inline-styles) por sus respectivas clases:**
- Reemplaza el `<div className="admin-page" ...>` principal por `<div className="admin-page-container">`.
- Reemplaza el `<header style={{ display: 'flex'... }}>` superior por `<header className="admin-header">`.
- En el "Nuevo Producto", para la sección de "Tallas y Existencias:", envuelve los inputs cambiando el div que tiene `gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))'` por `<div className="tallas-grid">`.
- En "Nuevo Cliente" cambia el formulario en línea que tiene `style={{ display: 'flex'... }}` por `<form onSubmit={async e => ...} className="customer-form">`.

4. **Arregla las cuadrículas colapsables en los Paneles Flotantes (Venta Actual y Pedido Proveedor):**
- **En Venta Actual:** Envuelve cada elemento del carrito (Talla, Cant, Precio Uni, Total) usando `<div className="cart-item-grid">` usando etiquetas `<label>` individuales encima de cada *select* e `input`, y asegúrate de quitar los estilos *inline* de width 100% redundantes dentro para dejar que el CSS maestro de `.cart-item-grid input { min-width: 0 }` actúe libremente.
- **En Pedido Proveedor:** Haz lo mismo para la fila del producto (Cant, Talla, Precio Venta) usando `<div className="order-item-grid">`. Es primordial que dejes que los *inputs* en los layouts *Grid* tengan `min-width: 0` global en el CSS para que los números no rompan la pantalla en móviles.
