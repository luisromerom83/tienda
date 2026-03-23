import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    
    // Con onSnapshot, la tienda se actualiza en tiempo real!
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
        <div></div>
      </header>

      <section style={{ marginBottom: '5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>Descubre Estilo <br/> Sin Límites</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Explora nuestra colección curada de productos exclusivos diseñados para destacar.
        </p>
      </section>

      <div className="grid">
        {products.map(product => (
          <div key={product.id} className="glass card">
            <div style={{ position: 'relative' }}>
              <img src={product.imageURL} alt={product.name} className="product-img" />
              <span className="badge" style={{ 
                position: 'absolute', 
                top: '1rem', 
                right: '1rem',
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(5px)',
                color: 'white'
              }}>{product.size}</span>
            </div>
            <div className="product-info">
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{product.name}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span className="price">${product.price}</span>
                <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  Ver más
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando catálogo...</p>}

      {!loading && products.length === 0 && (
        <div className="glass" style={{ textAlign: 'center', padding: '5rem', marginTop: '2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            Nuestro catálogo está siendo actualizado. <br/> Vuelve pronto para ver las novedades.
          </p>
        </div>
      )}

      <footer style={{ marginTop: '8rem', padding: '4rem 0', textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>© 2024 DEPORTUX. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default Catalog;
