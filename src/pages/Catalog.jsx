import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [useTestData, setUseTestData] = useState(false);
  
  const { catName } = useParams();
  const navigate = useNavigate();
  const currentCategory = catName || 'home';

  useEffect(() => {
    fetchProducts();
  }, [useTestData]);

  const fetchProducts = async () => {
    const startTime = Date.now();
    try {
      const response = await fetch(`/api/products${useTestData ? '?test=true' : ''}`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error products:", error);
    } finally {
      // Garantizar que la animación se vea al menos 800ms
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 800 - elapsedTime);
      
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = (currentCategory === 'Adulto' && (p.category === 'Adulto' || !p.category)) || 
                            (currentCategory === 'Niño' && p.category === 'Niño');
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    // 1. Favoritos primero
    if (b.is_favorite !== a.is_favorite) return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
    // 2. Existencia (stock) segundo
    if (a.type !== b.type) return (a.type === 'stock' ? -1 : 1);
    // 3. Alfabético tercero
    return a.name.localeCompare(b.name);
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartVisible(true);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const checkoutToWhatsApp = () => {
    const phone = "525514512919";
    let message = `*DEPORTUX - Nuevo Pedido* 🛒\n\n`;
    let total = 0;
    
    cart.forEach(item => {
      const priceText = item.type === 'order' ? 'Cotizar' : `$${item.price}`;
      message += `• ${item.quantity}x ${item.name} (${item.size || 'N/A'}) - ${priceText}\n`;
      if (item.type !== 'order') total += item.price * item.quantity;
    });

    if (total > 0) message += `\n*TOTAL APROX:* $${total}`;
    message += `\n\n_Por favor confirmar existencias y tallas._`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="catalog-page">
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem',
        padding: '1rem 0', borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={() => navigate('/')} className="pointer">
          <img src="/logo.png" alt="DEPORTUX" style={{ height: '60px', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Elegancia Deportiva</span>
        </div>
      </header>

      <section style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="https://wa.me/525514512919" target="_blank" rel="noreferrer" className="btn" style={{ 
            background: '#25D366', color: 'white', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '99px' 
          }}>
            📲 WhatsApp 5514512919
          </a>
          <a href="https://wa.me/522872360877" target="_blank" rel="noreferrer" className="btn" style={{ 
            background: '#25D366', color: 'white', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '99px' 
          }}>
            📲 WhatsApp 2872360877
          </a>
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', marginBottom: '0.5rem', lineHeight: '1.1' }}>
          Tu Estilo, <br/> Bajo Tus Reglas
        </h1>
      </section>

      <Loader show={loading} />

      {currentCategory === 'home' ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
          <CategoryCard 
            title="Catálogo Adultos" 
            desc="Uniformes profesionales, stock y personalizados." 
            img="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2093&auto=format&fit=crop" 
            onClick={() => navigate('/category/Adulto')} 
          />
          <CategoryCard 
            title="Catálogo Niños" 
            desc="Equipación oficial para las futuras estrellas del deporte." 
            img="/kids-hero.png" 
            onClick={() => navigate('/category/Niño')} 
          />
        </section>
      ) : (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => navigate('/')} 
              className="btn glass" 
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--primary)' }}
            >
              ⬅️ Regresar a Inicio
            </button>
            <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--primary)' }}>
              {currentCategory === 'Adulto' ? 'Catálogo Adultos' : 'Catálogo Niños'}
            </h2>
            <div style={{ height: '1px', background: 'var(--glass-border)', flexGrow: 1 }}></div>
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <input 
              type="text" 
              placeholder="Buscar uniforme por nombre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass"
              style={{ 
                width: '100%', 
                padding: '1rem 1.5rem', 
                borderRadius: '99px', 
                fontSize: '1rem',
                border: '1px solid var(--glass-border)',
                outline: 'none',
                color: 'white',
                background: 'rgba(255,255,255,0.03)'
              }} 
            />
          </div>
          
          <div className="grid">
            {loading ? (
              Array(6).fill(0).map((_, i) => <ProductSkeleton key={i} />)
            ) : (
              <>
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onOpenImage={setSelectedImage} 
                    onAddToCart={() => addToCart(product)}
                  />
                ))}
                {filteredProducts.length === 0 && <p style={{ textAlign: 'center', width: '100%', opacity: 0.5 }}>Próximamente más modelos...</p>}
              </>
            )}
          </div>
        </section>
      )}

      {/* CARRITO FLOTANTE */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 500,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem'
        }}>
          {isCartVisible && (
            <div className="glass" style={{
              width: '320px', maxHeight: '450px', padding: '1.5rem', borderRadius: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Tu Pedido</h3>
                <button onClick={() => setIsCartVisible(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img src={item.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 'bold', margin:0 }}>{item.name}</p>
                      <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{item.type === 'order' ? 'Cotizar' : `$${item.price}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => updateQuantity(item.id, -1)} className="glass" style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white' }}>-</button>
                      <span style={{ fontSize: '0.85rem' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="glass" style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white' }}>+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{ color: '#ff4444', background: 'none', border: 'none' }}>×</button>
                  </div>
                ))}
              </div>
              <button 
                onClick={checkoutToWhatsApp}
                className="btn btn-primary" 
                style={{ background: '#25D366', color: 'white', width: '100%', marginTop: '0.5rem' }}
              >
                📲 Confirmar Pedido en WhatsApp
              </button>
            </div>
          )}
          
          <button 
            onClick={() => setIsCartVisible(!isCartVisible)}
            className="btn btn-primary" 
            style={{ 
              width: '64px', height: '64px', borderRadius: '50%', fontSize: '1.5rem',
              boxShadow: '0 10px 30px rgba(239, 129, 30, 0.4)', position: 'relative'
            }}
          >
            🛒
            <span style={{
              position: 'absolute', top: '-5px', right: '-5px', background: 'white', color: 'var(--primary)',
              width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 'bold',
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}>{cart.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </button>
        </div>
      )}

      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, cursor: 'zoom-out'
          }}
        >
          <img src={selectedImage} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} />
          <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', color: 'white', fontSize: '3rem' }}>×</button>
        </div>
      )}

      <footer style={{ marginTop: '8rem', padding: '4rem 0', textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>© 2024 DEPORTUX. Envíos a todo el país.</p>
        <button 
          onClick={() => setUseTestData(!useTestData)}
          style={{ marginTop: '1rem', opacity: 0.2, fontSize: '0.6rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          {useTestData ? 'Usar BD Real' : 'Usar Mock Data (Test)'}
        </button>
      </footer>
    </div>
  );
};

const CategoryCard = ({ title, desc, img, onClick }) => (
  <div 
    onClick={onClick}
    className="glass" 
    style={{ 
      height: '400px', borderRadius: '1.5rem', overflow: 'hidden', cursor: 'pointer', position: 'relative',
      transition: 'transform 0.3s ease-out'
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent 30%, #0f172a 100%)' }}></div>
    </div>
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem' }}>{desc}</p>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Ver Catálogo ➔</button>
    </div>
  </div>
);

const ProductCard = ({ product, onOpenImage, onAddToCart }) => {
  const isOrder = product.type === 'order';
  return (
    <div className="glass card">
      <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => onOpenImage(product.image_url)}>
        <img src={product.image_url} alt={product.name} className="product-img" loading="lazy" />
        <span className="badge" style={{ 
          position: 'absolute', top: '1rem', left: '1rem', background: isOrder ? '#fbbf24' : '#10b981',
          color: isOrder ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.65rem'
        }}>{isOrder ? 'BAJO PEDIDO' : 'EN EXISTENCIA'}</span>
        {!isOrder && (
          <span className="badge" style={{ 
            position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)', color: 'white', fontSize: '0.65rem'
          }}>Talla {product.size}</span>
        )}
        <span className="badge" style={{ 
          position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)', color: 'white', fontSize: '0.6rem', padding: '0.2rem 0.6rem',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>{product.category?.toUpperCase() || 'ADULTO'}</span>
      </div>
      <div className="product-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{product.name}</h3>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.82rem', opacity: 0.9 }}>#{product.short_id}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <span className="price" style={{ color: isOrder ? '#fbbf24' : 'inherit' }}>
            {isOrder ? 'Cotizar' : `$${product.price}`}
          </span>
          <button onClick={onAddToCart} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
            {isOrder ? 'Consultar' : 'Añadir 🛒'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductSkeleton = () => (
  <div className="glass card" style={{ height: '380px' }}>
    <div className="skeleton" style={{ height: '240px', width: '100%' }}></div>
    <div className="product-info" style={{ gap: '1rem' }}>
      <div className="skeleton" style={{ height: '1.5rem', width: '100%' }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div className="skeleton" style={{ height: '1.2rem', width: '80px' }}></div>
        <div className="skeleton" style={{ height: '2.5rem', width: '100px', borderRadius: 'var(--radius-md)' }}></div>
      </div>
    </div>
  </div>
);

export default Catalog;
