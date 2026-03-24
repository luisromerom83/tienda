import { useState, useEffect } from 'react';

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      console.error("Error al obtener productos:", error);
      setLoading(false);
    }
  };

  const categories = ['Adulto', 'Niño'];

  return (
    <div className="catalog-page">
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '4rem',
        padding: '1rem 0',
        borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="DEPORTUX" style={{ height: '40px' }} />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Elegancia Deportiva</span>
        </div>
      </header>

      <section style={{ marginBottom: '5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', marginBottom: '1rem', lineHeight: '1.1' }}>
          Tu Estilo, <br/> Bajo Tus Reglas
        </h1>
      </section>

      {categories.map(cat => {
        const catProducts = products.filter(p => (cat === 'Adulto' && (!p.category || p.category === 'Adulto')) || p.category === cat);
        if (catProducts.length === 0) return null;
        return (
          <section key={cat} style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '2px' }}>{cat}s</h2>
              <div style={{ height: '1px', background: 'var(--glass-border)', width: '100%' }}></div>
            </div>
            <div className="grid">
              {catProducts.map(product => (
                <ProductCard key={product.id} product={product} onOpenImage={setSelectedImage} />
              ))}
            </div>
          </section>
        );
      })}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Cargando catálogo...</p>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            cursor: 'zoom-out'
          }}
        >
          <img src={selectedImage} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} />
          <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', color: 'white', fontSize: '3rem' }}>×</button>
        </div>
      )}

      <footer style={{ marginTop: '8rem', padding: '4rem 0', textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>© 2024 DEPORTUX. Envíos a todo el país.</p>
      </footer>
    </div>
  );
};

const ProductCard = ({ product, onOpenImage }) => {
  const isOrder = product.type === 'order';
  return (
    <div className="glass card">
      <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => onOpenImage(product.image_url)}>
        <img src={product.image_url} alt={product.name} className="product-img" />
        <span className="badge" style={{ 
          position: 'absolute', 
          top: '1rem', 
          left: '1rem',
          background: isOrder ? '#fbbf24' : '#10b981',
          color: isOrder ? 'black' : 'white',
          fontWeight: 'bold',
          fontSize: '0.65rem'
        }}>
          {isOrder ? 'BAJO PEDIDO' : 'EN EXISTENCIA'}
        </span>
        {!isOrder && (
          <span className="badge" style={{ 
            position: 'absolute', 
            top: '1rem', 
            right: '1rem',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            color: 'white',
            fontSize: '0.65rem'
          }}>Talla {product.size}</span>
        )}
        <span className="badge" style={{ 
          position: 'absolute', 
          bottom: '1rem', 
          left: '1rem',
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          color: 'white',
          fontSize: '0.6rem',
          letterSpacing: '1px',
          padding: '0.2rem 0.6rem',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>{product.category?.toUpperCase() || 'ADULTO'}</span>
      </div>
      <div className="product-info">
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{product.name}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <span className="price" style={{ color: isOrder ? '#fbbf24' : 'inherit' }}>
            {isOrder ? 'Preguntar Precio' : `$${product.price}`}
          </span>
          <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
            {isOrder ? 'Cotizar' : 'Comprar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Catalog;
