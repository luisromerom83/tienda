import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [activeOrderItems, setActiveOrderItems] = useState([]);
  const [expandedSummary, setExpandedSummary] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', password: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [hoveredImage, setHoveredImage] = useState(null);
  
  const [newProduct, setNewProduct] = useState({ 
    name: '', size: '', price: '', type: 'stock', category: 'Adulto', is_favorite: false, image: null 
  });
  const [editingId, setEditingId] = useState(null);
  const [currentImageURL, setCurrentImageURL] = useState('');
  const [manualItem, setManualItem] = useState({ name: '', size: '', quantity: 1, comment: '' });
  const [isNinoOpen, setIsNinoOpen] = useState(true);
  const [isAdultoOpen, setIsAdultoOpen] = useState(true);

  useEffect(() => {
    const auth = sessionStorage.getItem('isAdminAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchProducts(); fetchOrdersHistory();
      // Intentamos recuperar del servidor primero para persistencia entre dispositivos
      fetch('/api/orders?type=draft')
        .then(res => res.json())
        .then(data => { 
          if (data && data.length) setActiveOrderItems(data);
          else {
            const cached = localStorage.getItem('deportux_draft_order');
            if (cached) setActiveOrderItems(JSON.parse(cached));
          }
        })
        .catch(() => {
          const cached = localStorage.getItem('deportux_draft_order');
          if (cached) setActiveOrderItems(JSON.parse(cached));
        });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('deportux_draft_order', JSON.stringify(activeOrderItems));
      
      // Sincronización con el servidor (Debounced 1s)
      const timer = setTimeout(() => {
        fetch('/api/orders?type=draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: activeOrderItems })
        }).catch(e => console.error("Error sincronizando borrador:", e));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [activeOrderItems, isAuthenticated]);

  const fetchProducts = async () => {
    try {
      const resp = await fetch('/api/products');
      const data = await resp.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const fetchOrdersHistory = async () => {
    try {
      const resp = await fetch('/api/orders');
      const data = await resp.json();
      setOrdersHistory(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageURL = currentImageURL;
      if (newProduct.image) {
        const base64Image = await fileToBase64(newProduct.image);
        const uploadResp = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProduct.image.name, base64: base64Image })
        });
        const blob = await uploadResp.json();
        imageURL = blob.url;
      }
      const method = editingId ? 'PUT' : 'POST';
      const payload = {
        name: newProduct.name, 
        size: (newProduct.type === 'order' && !newProduct.size) ? 'N/A' : newProduct.size,
        price: (newProduct.type === 'order' && !newProduct.price) ? 0 : parseFloat(newProduct.price),
        imageURL, 
        type: newProduct.type,
        category: newProduct.category || 'Adulto',
        is_favorite: newProduct.is_favorite || false,
        ...(editingId && { id: editingId })
      };
      await fetch('/api/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      alert('Guardado'); resetForm(); fetchProducts();
    } catch (err) { alert(err.message); } finally { setIsUploading(false); }
  };

  const deleteProduct = async (id) => {
    if (window.confirm("¿Eliminar del catálogo?")) {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const deleteOrderHistory = async (id) => {
    if (window.confirm("¿Borrar historial?")) {
        setDeletingId(id);
        setTimeout(async () => {
            try {
                const resp = await fetch(`/api/orders?id=${id}`, { method: 'DELETE' });
                if (resp.ok) setOrdersHistory(prev => prev.filter(h => h.id !== id));
            } catch (e) { console.error(e); }
            setDeletingId(null);
        }, 500);
    }
  };

  const addToOrderList = (p) => {
    setActiveOrderItems([...activeOrderItems, {
      orderId: Date.now(), id: p.id, name: p.name, price: parseFloat(p.price || 0),
      size: p.size === 'N/A' ? '' : p.size, image_url: p.image_url, quantity: 1, comment: ''
    }]);
  };

  const addManualItem = () => {
    if (!manualItem.name) return alert("Nombre?");
    setActiveOrderItems([...activeOrderItems, {
      orderId: Date.now(), id: 'manual', name: manualItem.name, price: 0,
      size: manualItem.size, image_url: '/logo.png', quantity: parseInt(manualItem.quantity) || 1, comment: manualItem.comment
    }]);
    setManualItem({ name: '', size: '', quantity: 1, comment: '' });
  };

  const updateOrderItem = (orderId, updates) => {
    setActiveOrderItems(activeOrderItems.map(item => item.orderId === orderId ? { ...item, ...updates } : item));
  };

  const getTotal = () => {
    const total = activeOrderItems.reduce((acc, i) => acc + (parseFloat(i.price) * (parseInt(i.quantity) || 1)), 0);
    return isNaN(total) ? "0.00" : total.toFixed(2);
  };

  const getSummaryForItems = (itemsList) => {
    const summary = {};
    itemsList.forEach(item => {
      const key = `${item.name}-${item.size}`;
      if (!summary[key]) summary[key] = { name: item.name, size: item.size, total: 0, items: [] };
      const q = parseInt(item.quantity) || 1;
      summary[key].total += q;
      summary[key].items.push({ q, name: item.name, size: item.size, comment: item.comment });
    });
    return Object.values(summary);
  };

  const downloadSummaryXLSX = () => {
    const summary = getSummaryForItems(activeOrderItems);
    const data = summary.map(g => ({
      "Cantidad de uniformes": g.total,
      "Nombre Uniforme": g.name,
      "Talla": g.size || 'Unica'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido Proveedor");
    XLSX.writeFile(wb, `Pedido_Deportux_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const resetForm = () => {
    setNewProduct({ name: '', size: '', price: '', type: 'stock', category: 'Adulto', is_favorite: false, image: null });
    setEditingId(null); setCurrentImageURL('');
  };

  const handleEdit = (p) => {
    setNewProduct({ name: p.name, size: p.size, price: p.price, type: p.type, category: p.category || 'Adulto', is_favorite: p.is_favorite || false, image: null });
    setEditingId(p.id); setCurrentImageURL(p.image_url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateProductAttribute = async (id, attribute, value) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const updated = { ...product, [attribute]: value };
    try {
      await fetch('/api/products', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          ...updated,
          imageURL: updated.image_url // API expects imageURL
        }) 
      });
      setProducts(products.map(p => p.id === id ? updated : p));
    } catch (e) { console.error(e); }
  };

  if (!isAuthenticated) return (
     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
       <div className="glass" style={{ padding: '3rem', width: '100%', maxWidth: '400px' }}>
         <h2>DEPORTUX Admin</h2>
         <form onSubmit={(e) => {
           e.preventDefault();
           if (loginData.user === 'admin' && loginData.password === 'Anitalavalatin4') {
             setIsAuthenticated(true); sessionStorage.setItem('isAdminAuthenticated', 'true'); 
             fetchProducts(); fetchOrdersHistory();
           } else alert('Error');
         }} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
           <input type="text" placeholder="User" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, user: e.target.value})} />
           <input type="password" placeholder="Pass" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, password: e.target.value})} />
           <button type="submit" className="btn btn-primary">Entrar</button>
         </form>
       </div>
     </div>
  );

  return (
    <div className="admin-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <style>{`
        .inline-edit:hover { background: rgba(255,255,255,0.05) !important; border-radius: 4px; }
        .inline-edit:focus { background: rgba(255,255,255,0.1) !important; border-bottom: 1px solid var(--primary) !important; border-radius: 4px 4px 0 0; }
        .collapse-header:hover { background: rgba(255,255,255,0.05); }
      `}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '40px' }} />
          <h1 style={{ fontSize: '1.5rem' }}>Admin Deportux</h1>
        </div>
        <Link to="/" className="btn">Ir al Catálogo</Link>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'start' }}>
        <div style={{ flex: '1.2', minWidth: '320px' }}>
          <section className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Añadir/Editar Producto</h3>
            <form onSubmit={handleCatalogSubmit} style={{ display: 'grid', gap: '0.8rem', marginTop: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
                    <input type="text" placeholder="Nombre" required className="glass" style={{ padding: '0.5rem' }} value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    <input type="text" placeholder="Talla" required={newProduct.type === 'stock'} className="glass" style={{ padding: '0.5rem' }} value={newProduct.size} onChange={e => setNewProduct({...newProduct, size: e.target.value})} />
                    <select className="glass" style={{ padding: '0.5rem', background: '#1e293b' }} value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                        <option value="Adulto">Adulto</option>
                        <option value="Niño">Niño</option>
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.8rem' }}>
                    <select className="glass" style={{ padding: '0.5rem', background: '#1e293b' }} value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value})}>
                        <option value="stock">Existencia</option>
                        <option value="order">Bajo Pedido</option>
                    </select>
                    <input type="number" placeholder="Precio ($)" required={newProduct.type === 'stock'} className="glass" style={{ padding: '0.5rem' }} value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                    <input type="file" accept="image/*" className="glass" style={{ padding: '0.3rem', fontSize: '0.7rem' }} onChange={e => setNewProduct({...newProduct, image: e.target.files[0]})} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="fav-check"
                      checked={newProduct.is_favorite} 
                      onChange={e => setNewProduct({...newProduct, is_favorite: e.target.checked})} 
                    />
                    <label htmlFor="fav-check" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>★ Destacar este producto (Favorito)</label>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }} disabled={isUploading}>{isUploading ? 'Procesando...' : 'Guardar Producto'}</button>
            </form>
          </section>

          <h2>Inventario General</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
              <div 
                onClick={() => setIsNinoOpen(!isNinoOpen)} 
                className="collapse-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '1rem' }}
              >
                <p style={{ color: '#fbbf24', fontWeight: 'bold', margin: 0 }}>NIÑO ({products.filter(p => p.category === 'Niño').length})</p>
                <span>{isNinoOpen ? '▲' : '▼'}</span>
              </div>
              {isNinoOpen && (
                <div style={{ padding: '0 1rem 1rem 1rem' }}>
                    {products.filter(p => p.category === 'Niño').map(p => (
                        <AdminItem key={p.id} p={p} onAdd={addToOrderList} onDelete={deleteProduct} onEdit={handleEdit} onHover={setHoveredImage} onUpdate={updateProductAttribute} />
                    ))}
                </div>
              )}
            </div>
            
            <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
              <div 
                onClick={() => setIsAdultoOpen(!isAdultoOpen)} 
                className="collapse-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '1rem' }}
              >
                <p style={{ color: 'var(--primary)', fontWeight: 'bold', margin: 0 }}>ADULTO ({products.filter(p => !p.category || p.category === 'Adulto').length})</p>
                <span>{isAdultoOpen ? '▲' : '▼'}</span>
              </div>
              {isAdultoOpen && (
                <div style={{ padding: '0 1rem 1rem 1rem' }}>
                    {products.filter(p => !p.category || p.category === 'Adulto').map(p => (
                        <AdminItem key={p.id} p={p} onAdd={addToOrderList} onDelete={deleteProduct} onEdit={handleEdit} onHover={setHoveredImage} onUpdate={updateProductAttribute} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside style={{ flex: '1', minWidth: '320px' }}>
          <div className="glass" style={{ padding: '1.5rem', border: '2px solid var(--primary)', position: 'sticky', top: '1rem' }}>
            <h3>Pedido Actual 🛒</h3>
            <div className="glass" style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', marginBottom: '1rem' }}>
              <input type="text" placeholder="Manual..." className="glass" style={{ padding: '0.3rem', width: '100%', marginBottom: '0.5rem' }} value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="text" placeholder="Talla" className="glass" style={{ padding: '0.3rem', width: '100%', minWidth: 0 }} value={manualItem.size} onChange={e => setManualItem({...manualItem, size: e.target.value})} />
                <button onClick={addManualItem} className="btn btn-primary" style={{ padding: '0.3rem' }}>+</button>
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activeOrderItems.map(item => (
                <div key={item.orderId} className="glass" style={{ padding: '0.8rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.8rem' }}>{item.name}</strong>
                    <button onClick={() => setActiveOrderItems(activeOrderItems.filter(i => i.orderId !== item.orderId))} style={{ color: '#ff4444', background: 'none', border: 'none' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <input type="text" className="glass" style={{ padding: '0.2rem', width: '100%', minWidth: 0 }} value={item.size} onChange={e => updateOrderItem(item.orderId, { size: e.target.value })} />
                    <input type="number" className="glass" style={{ padding: '0.2rem', width: '100%', minWidth: 0 }} value={item.quantity} onChange={e => updateOrderItem(item.orderId, { quantity: e.target.value })} />
                    <input type="number" className="glass" style={{ padding: '0.2rem', width: '100%', minWidth: 0 }} value={item.price} onChange={e => updateOrderItem(item.orderId, { price: e.target.value })} />
                  </div>
                  <input type="text" className="glass" style={{ width: '100%', padding: '0.2rem', marginTop: '0.4rem' }} value={item.comment} onChange={e => updateOrderItem(item.orderId, { comment: e.target.value })} placeholder="Notas..." />
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #444', marginTop: '1rem', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}><span>Total:</span><span>${getTotal()}</span></div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }} onClick={async () => {
                if (!activeOrderItems.length || !window.confirm("Finalizar?")) return;
                await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: activeOrderItems, total_price: getTotal() }) });
                setActiveOrderItems([]); localStorage.removeItem('deportux_draft_order'); fetchOrdersHistory(); alert('Listo');
              }}>FINALIZAR PEDIDO</button>
            </div>
          </div>
        </aside>
      </div>

      <section style={{ marginTop: '5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary)' }}>Resumen del Trabajo Actual (Proveedor)</h2>
          <button onClick={downloadSummaryXLSX} className="btn" style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
            📥 Descargar XLSX (Excel)
          </button>
        </div>
        <div className="glass" style={{ padding: '2rem' }}>
          {getSummaryForItems(activeOrderItems).map((g, idx) => (
            <div key={idx} style={{ marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem' }}>
              <div style={{ fontSize: '1.1rem' }}>
                <strong style={{ color: 'var(--primary)' }}>{g.total}x</strong> {g.name} <strong>({g.size || 'Unique'})</strong>
              </div>
              <div style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                {g.items.map((it, iIdx) => (
                  <div key={iIdx} style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '0.2rem' }}>
                    - {it.q}x [{g.name} ({g.size})] &raquo; {it.comment || '(Sin notas)'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {hoveredImage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '1rem',
          borderRadius: '1rem',
          boxShadow: '0 0 50px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <img src={hoveredImage} style={{ maxWidth: '400px', maxHeight: '400px', borderRadius: '0.5rem', display: 'block', border: '2px solid white' }} alt="" />
        </div>
      )}
    </div>
  );
};

const AdminItem = ({ p, onAdd, onDelete, onEdit, onHover, onUpdate }) => (
  <div className="glass" style={{ padding: '0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem', position: 'relative' }}>
    <div style={{ position: 'absolute', top: '0', left: '0', background: p.type === 'order' ? '#f59e0b' : '#10b981', color: 'white', fontSize: '0.5rem', padding: '2px 4px', borderRadius: '4px 0 4px 0', zIndex: 1 }}>
        {p.type === 'order' ? 'BAJO PEDIDO' : 'STOCK'}
    </div>
    <div style={{ position: 'absolute', bottom: '0.6rem', left: '0.6rem', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.4rem', padding: '1px 3px', borderRadius: '2px', zIndex: 1, letterSpacing: '0.5px' }}>
        {p.category?.toUpperCase() || 'ADULTO'}
    </div>
    <img 
      src={p.image_url} 
      style={{ width: '45px', height: '45px', borderRadius: '4px', cursor: 'zoom-in' }} 
      alt="" 
      onMouseEnter={() => onHover(p.image_url)}
      onMouseLeave={() => onHover(null)}
    />
    <div style={{ flex: 1 }}>
      <input 
        type="text" 
        defaultValue={p.name}
        onBlur={(e) => {
          if (e.target.value !== p.name) onUpdate(p.id, 'name', e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
        }}
        style={{ 
          background: 'none', border: 'none', color: 'white', width: '100%', 
          fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px transparent solid',
          outline: 'none', padding: '2px 0'
        }}
        className="inline-edit"
        title="Clic para editar nombre"
      />
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
        <button onClick={() => onAdd(p)} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+</button>
        <button onClick={() => onEdit(p)} className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: '#3b82f6' }}>E</button>
        <button onClick={() => onDelete(p.id)} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>×</button>
      </div>
    </div>
    {p.is_favorite && <div style={{ position: 'absolute', top: '0', right: '0', color: '#fbbf24', fontSize: '1rem', padding: '2px' }}>★</div>}
  </div>
);

export default AdminDashboard;
