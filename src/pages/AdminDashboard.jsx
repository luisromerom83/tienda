import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', password: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    size: '',
    price: '',
    image: null
  });

  useEffect(() => {
    const auth = sessionStorage.getItem('isAdminAuthenticated');
    if (auth === 'true') setIsAuthenticated(true);
    
    if (auth === 'true') fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setProducts(items);
    } catch (error) {
      console.error("Error al obtener productos:", error);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.user === 'admin' && loginData.password === 'Anitalavalatin4') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      fetchProducts();
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAdminAuthenticated');
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setNewProduct({ ...newProduct, image: e.target.files[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newProduct.image) return alert('Por favor selecciona una imagen');
    
    setIsUploading(true);
    try {
      // 1. Subir imagen a Firebase Storage
      const storageRef = ref(storage, `products/${Date.now()}_${newProduct.image.name}`);
      await uploadBytes(storageRef, newProduct.image);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Guardar metadata en Firestore
      await addDoc(collection(db, "products"), {
        name: newProduct.name,
        size: newProduct.size,
        price: parseFloat(newProduct.price),
        imageURL: downloadURL,
        imagePath: storageRef.fullPath,
        createdAt: serverTimestamp()
      });

      setNewProduct({ name: '', size: '', price: '', image: null });
      e.target.reset();
      fetchProducts();
      alert('Producto guardado con éxito!');
    } catch (error) {
      console.error("Error al guardar:", error);
      alert('Error al guardar el producto.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteProduct = async (id, imagePath) => {
    if (window.confirm("¿Seguro que deseas eliminar este producto?")) {
      try {
        // 1. Borrar de Firestore
        await deleteDoc(doc(db, "products", id));
        
        // 2. Borrar de Storage si existe el path
        if (imagePath) {
          const imageRef = ref(storage, imagePath);
          await deleteObject(imageRef);
        }
        
        setProducts(products.filter(p => p.id !== id));
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="glass" style={{ padding: '3rem', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>Acceso Administrativo</h2>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.5rem' }}>
            <input type="text" placeholder="Usuario" required className="glass" style={{ padding: '1rem', color: 'white' }}
              value={loginData.user} onChange={(e) => setLoginData({ ...loginData, user: e.target.value })} />
            <input type="password" placeholder="Contraseña" required className="glass" style={{ padding: '1rem', color: 'white' }}
              value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Entrar</button>
          </form>
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>Volver a la tienda</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="DEPORTUX" style={{ height: '40px' }} />
          <h1>Panel de Administración</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/" className="btn" style={{ background: 'var(--glass-bg)', color: 'white' }}>Ver Tienda</Link>
          <button onClick={handleLogout} className="btn btn-danger">Cerrar Sesión</button>
        </div>
      </header>

      <div className="glass" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Agregar Nuevo Producto</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Nombre del Producto" required className="glass" style={{ padding: '0.75rem', color: 'white' }}
              value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} />
            <input type="text" placeholder="Talla (S, M, L, XL...)" required className="glass" style={{ padding: '0.75rem', color: 'white' }}
              value={newProduct.size} onChange={(e) => setNewProduct({...newProduct, size: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="number" placeholder="Precio ($)" required className="glass" style={{ padding: '0.75rem', color: 'white' }}
              value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} />
            <input type="file" accept="image/*" className="glass" style={{ padding: '0.5rem', color: 'white' }}
              onChange={handleImageChange} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '200px' }} disabled={isUploading}>
            {isUploading ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </form>
      </div>

      <h2>Productos en Catálogo</h2>
      <div className="grid" style={{ marginTop: '1.5rem' }}>
        {products.map(product => (
          <div key={product.id} className="glass card">
            <img src={product.imageURL} alt={product.name} className="product-img" />
            <div className="product-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="badge">{product.size}</span>
                <span className="price">${product.price}</span>
              </div>
              <h3 style={{ marginBottom: '1rem' }}>{product.name}</h3>
              <button onClick={() => deleteProduct(product.id, product.imagePath)} className="btn btn-danger" style={{ marginTop: 'auto', width: '100%' }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Cargando productos...</p>}
      </div>
    </div>
  );
};

export default AdminDashboard;
