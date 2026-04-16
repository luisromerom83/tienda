import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as ExcelJS from 'exceljs';
import Loader from '../components/Loader';

const AdminDashboard = () => {
  const [products, setProducts] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [activeOrderItems, setActiveOrderItems] = useState([]);
  const isTestMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', password: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ 
    name: '', size: '', price: '', type: 'stock', category: 'Adulto', is_favorite: false, image: null, stock_quantity: 0, stock_by_size: {} 
  });
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminFilterType, setAdminFilterType] = useState('all'); // all, favorites, stock, order
  const [editingId, setEditingId] = useState(null);
  const [currentImageURL, setCurrentImageURL] = useState('');
  const [openCategory, setOpenCategory] = useState('Adulto');
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [reservations, setReservations] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [generalAbonoAmount, setGeneralAbonoAmount] = useState('');
  const [activeSaleItems, setActiveSaleItems] = useState([]);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [salePaidAmount, setSalePaidAmount] = useState('');

  const [availableSizes, setAvailableSizes] = useState(() => {
    const saved = localStorage.getItem('deportux_available_sizes');
    if (!saved) return { Adulto: ['S', 'M', 'L', 'XL'], Niño: ['2', '4', '6', '8', '10', '12', '14', '16'] };
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return { Adulto: parsed, Niño: [] };
    return parsed;
  });

  useEffect(() => {
    localStorage.setItem('deportux_available_sizes', JSON.stringify(availableSizes));
  }, [availableSizes]);

  useEffect(() => {
    const init = async () => {
      const auth = sessionStorage.getItem('isAdminAuthenticated');
      if (auth === 'true') {
        setIsAuthenticated(true);
        await Promise.all([
          fetchProducts(),
          fetchOrdersHistory(),
          fetchDraft(),
          fetchCustomers(),
          fetchSales(),
          fetchReservations()
        ]);
      }
      setLoading(false);
    };
    init();
  }, []);
  useEffect(() => {
    // Auto-crear Público General si no existe (Caso-insensible)
    if (isAuthenticated && !loading && customers.length > 0) {
      const exists = customers.find(c => c.name.toLowerCase().includes('público') && c.name.toLowerCase().includes('general'));
      if (!exists) {
        fetch('/api/customers', { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ name: 'Público en General', phone: '0000000000' }) 
        }).then(() => fetchCustomers());
      }
    }
  }, [customers.length, isAuthenticated, loading]);

  const fetchProducts = async () => {
    try { 
      const r = await fetch('/api/products'); 
      if (!r.ok) throw new Error('Network error');
      setProducts(await r.json()); 
    } catch(e) {} 
  };
  const fetchOrdersHistory = async () => {
    try { const r = await fetch('/api/orders'); setOrdersHistory(await r.json()); } catch(e) { console.error(e); }
  };
  const fetchCustomers = async () => {
    try { const r = await fetch('/api/customers'); setCustomers(await r.json()); } catch(e) { console.error(e); }
  };
  const fetchSales = async () => {
    try { const r = await fetch('/api/sales'); setSales(await r.json()); } catch(e) { console.error(e); }
  };
  const fetchReservations = async () => {
    try { const r = await fetch('/api/reservations'); setReservations(await r.json()); } catch(e) { console.error(e); }
  };

  const fetchDraft = async () => {
    try {
      const r = await fetch('/api/orders?type=draft');
      const items = await r.json();
      if (items.length > 0) setActiveOrderItems(items);
      setIsDraftLoaded(true);
    } catch(e) {
      const cached = localStorage.getItem('deportux_draft_order');
      if (cached) setActiveOrderItems(JSON.parse(cached));
      setIsDraftLoaded(true);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isDraftLoaded) {
      localStorage.setItem('deportux_draft_order', JSON.stringify(activeOrderItems));
      const timer = setTimeout(() => {
        fetch('/api/orders?type=draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: activeOrderItems })
        }).catch(e => {}); // Silent catch for local dev sync
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isDraftLoaded) {
       localStorage.setItem('deportux_draft_order', JSON.stringify(activeOrderItems));
    }
  }, [activeOrderItems, isAuthenticated, isDraftLoaded]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const totalStock = Object.values(newProduct.stock_by_size).reduce((a, b) => a + (parseInt(b) || 0), 0);
    let imageURL = currentImageURL;

    try {
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
        ...newProduct,
        imageURL,
        id: editingId,
        stock_quantity: totalStock
      };
      const pResp = await fetch('/api/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!pResp.ok) throw new Error('Error al guardar producto');
      resetForm(); fetchProducts();
    } catch (err) { alert(err.message); } finally { setIsUploading(false); }
  };

  const resetForm = () => {
    setNewProduct({ name: '', size: '', price: '', type: 'stock', category: 'Adulto', is_favorite: false, image: null, stock_quantity: 0, stock_by_size: {} });
    setEditingId(null); setCurrentImageURL('');
  };

  const handleEdit = (p) => {
    setNewProduct({ 
      name: p.name, size: p.size, price: p.price, type: p.type, 
      category: p.category || 'Adulto', is_favorite: p.is_favorite || false, 
      image: null, stock_quantity: p.stock_quantity || 0,
      stock_by_size: p.stock_by_size || {}
    });
    setEditingId(p.id); setCurrentImageURL(p.image_url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar producto?')) {
      try {
        const resp = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Error al eliminar');
        fetchProducts();
      } catch (e) { console.error(e); }
    }
  };

  const addToOrderList = (p) => {
    // If it has multiple sizes, we don't pick the 'comma string', we pick the first one or empty
    const available = p.stock_by_size ? Object.keys(p.stock_by_size).filter(s => p.stock_by_size[s] > 0) : [];
    const defaultSize = available.length === 1 ? available[0] : '';
    
    setActiveOrderItems([...activeOrderItems, {
      orderId: Date.now(), id: p.id, name: p.name, price: parseFloat(p.price || 0),
      sale_price: parseFloat(p.price || 0), cost: 0, 
      size: defaultSize || (p.size && !p.size.includes(',') ? p.size : ''),
      image_url: p.image_url, quantity: 1, comment: '', category: p.category || 'Adulto',
      is_apartado: false, customer_id: null
    }]);
    setIsOrderOpen(true);
  };

  const updateOrderItem = (orderId, updates) => {
    let newItems = [...activeOrderItems];
    const idx = newItems.findIndex(i => i.orderId === orderId);
    if (idx === -1) return;
    
    let item = { ...newItems[idx], ...updates };
    
    // Auto-link to base product details without API fetch (Fast Lookup)
    if (updates.size && updates.size !== newItems[idx].size) {
      const baseProduct = products.find(p => p.name === item.name && (p.category || 'Adulto') === (item.category || 'Adulto'));
      if (baseProduct) {
        item.id = baseProduct.id;
        item.image_url = baseProduct.image_url;
        item.price = parseFloat(baseProduct.price);
      }
    }
    
    newItems[idx] = item;
    setActiveOrderItems(newItems);
  };

  const handleFinalizeOrder = async () => {
    if (!activeOrderItems.length || !window.confirm("¿Finalizar pedido a proveedor?")) return;
    setIsUploading(true);
    try {
      const totalVenta = activeOrderItems.reduce((acc, i) => acc + (parseFloat(i.sale_price) * i.quantity), 0);
      const totalCosto = activeOrderItems.reduce((acc, i) => acc + (parseFloat(i.cost || 0) * i.quantity), 0);
      
      const verifiedItems = activeOrderItems.map(it => ({ ...it, received: false }));
      
      const orderResp = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: verifiedItems, total_price: totalVenta, total_cost: totalCosto, total_profit: totalVenta - totalCosto, is_entered: false })
      });
      await orderResp.json();

      setActiveOrderItems([]); localStorage.removeItem('deportux_draft_order');
      fetchOrdersHistory(); fetchProducts(); setIsOrderOpen(false); 
      alert('Pedido registrado en historial. No olvides "Ingresar a Inventario" cuando recibas la mercancía.');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const toggleOrderItemReceived = async (order, itemIdx) => {
    // 1. Optimistic Update
    const rawItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const newItems = [...rawItems];
    newItems[itemIdx] = { ...newItems[itemIdx], received: !newItems[itemIdx].received };
    
    const updatedOrder = { ...order, items: newItems };
    setOrdersHistory(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

    // 2. Background sync
    try {
      await fetch('/api/orders', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
      // We don't strictly need fetchOrdersHistory() here unless we expect concurrent edits
    } catch (e) { 
      console.error(e);
      // Revert if failed
      fetchOrdersHistory();
    }
  };

  const markAllAsReceived = async (order) => {
    // 1. Optimistic Update
    const rawItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const newItems = rawItems.map(it => ({ ...it, received: true }));
    
    const updatedOrder = { ...order, items: newItems };
    setOrdersHistory(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

    try {
      await fetch('/api/orders', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
    } catch (e) { 
      console.error(e);
      fetchOrdersHistory();
    }
  };

  const handleReturnSale = async (id) => {
    if (!window.confirm("¿Procesar devolución? Los productos volverán al stock y el saldo del cliente se ajustará.")) return;
    setIsUploading(true);
    try {
      await fetch(`/api/sales?id=${id}`, { method: 'DELETE' });
      fetchSales(); fetchProducts(); fetchCustomers();
      alert('Devolución procesada con éxito!');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const handleReassignSale = async (saleId, newCustomerId) => {
    // Buscar si el nuevo cliente es Público General
    const pgCustomer = customers.find(c => c.name.toLowerCase().includes('público en general') || c.name.toLowerCase().includes('público general'));
    const isPublic = !newCustomerId || (pgCustomer && String(newCustomerId) === String(pgCustomer.id));
    
    // Verificar si la venta tiene deuda
    const sale = sales.find(s => s.id === saleId);
    const hasDebt = sale && parseFloat(sale.total_amount) > parseFloat(sale.paid_amount);

    if (isPublic && hasDebt) {
      return alert("No se puede asignar una venta con deuda a Público General. Debe estar liquidada.");
    }

    if (!window.confirm("¿Cambiar el cliente de esta venta? Los saldos se ajustarán.")) return;
    setIsUploading(true);
    try {
      await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saleId, customer_id: newCustomerId === "" ? null : newCustomerId })
      });
      fetchSales(); fetchCustomers();
      alert('Venta reasignada!');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const handleReceiveIntoInventory = async (order) => {
    if (order.is_entered) return alert("Este pedido ya fue ingresado");
    if (!window.confirm("¿Ingresar estos artículos al inventario? (Actualizará stock y apartados)")) return;
    
    setIsUploading(true);
    try {
      const allItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
      const receivedItems = allItems.filter(it => it.received);
      
      if (receivedItems.length === 0) return alert("No hay artículos marcados como recibidos.");
      
      if (receivedItems.length < allItems.length) {
        if (!window.confirm(`Solo has marcado ${receivedItems.length} de ${allItems.length} artículos. ¿Deseas ingresar SOLO los marcados e IGNORAR el resto?`)) {
          setIsUploading(false);
          return;
        }
      }

      // Agrupar cambios por producto para evitar sobrescritura (Race Condition)
      const updatesMap = new Map();
      const reservationsToCreate = [];

      for (const item of receivedItems) {
        if (item.is_apartado && item.customer_id) {
          reservationsToCreate.push(item);
        } else if (item.id !== 'manual') {
          if (!updatesMap.has(item.id)) {
            const p = products.find(x => String(x.id) === String(item.id));
            if (p) {
              updatesMap.set(item.id, { 
                product: p, 
                newStockBySize: { ...(p.stock_by_size || {}) } 
              });
            }
          }
          
          const updateData = updatesMap.get(item.id);
          if (updateData) {
            updateData.newStockBySize[item.size] = (parseInt(updateData.newStockBySize[item.size]) || 0) + parseInt(item.quantity);
          }
        }
      }

      // 1. Procesar Apartados
      for (const resItem of reservationsToCreate) {
        await fetch('/api/reservations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: resItem.id, customer_id: resItem.customer_id, order_id: order.id, quantity: resItem.quantity, price_at_reservation: resItem.sale_price || resItem.price, is_received: true })
        });
      }

      // 2. Procesar Actualizaciones de Inventario Agregadas
      for (const [prodId, data] of updatesMap.entries()) {
        const newTotalStock = Object.values(data.newStockBySize).reduce((a, b) => a + (parseInt(b) || 0), 0);
        await fetch('/api/products', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data.product, stock_quantity: newTotalStock, stock_by_size: data.newStockBySize, imageURL: data.product.image_url })
        });
      }
      await fetch('/api/orders', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, is_entered: true })
      });
      fetchOrdersHistory(); fetchProducts(); fetchReservations();
      alert('Inventario actualizado con éxito!');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const addToSaleList = (p) => {
    const available = p.stock_by_size ? Object.keys(p.stock_by_size).filter(s => p.stock_by_size[s] > 0) : [];
    const defaultSize = available.length === 1 ? available[0] : '';
    
    setActiveSaleItems([...activeSaleItems, {
      saleId: Date.now(), id: p.id, name: p.name, price: parseFloat(p.price || 0),
      size: defaultSize || '', image_url: p.image_url, quantity: 1, category: p.category || 'Adulto',
      stock_by_size: p.stock_by_size || {}
    }]);
    setIsSaleOpen(true);
  };

  const updateSaleItem = (saleId, updates) => {
    setActiveSaleItems(prev => prev.map(i => i.saleId === saleId ? { ...i, ...updates } : i));
  };

  const handleFinalizeSale = async () => {
    if (!activeSaleItems.length || !window.confirm("¿Finalizar venta directa?")) return;

    const totalAmount = activeSaleItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const paidAmount = parseFloat(salePaidAmount) || totalAmount;
    
    // Validar pago total para Público en General
    const pgCustomer = customers.find(c => c.name.toLowerCase().includes('público en general') || c.name.toLowerCase().includes('público general'));
    const isPublic = !saleCustomerId || (pgCustomer && String(saleCustomerId) === String(pgCustomer.id));
    
    if (isPublic && paidAmount < totalAmount) {
      return alert("Las ventas a Público en General deben ser liquidadas totalmente (sin deuda).");
    }

    setIsUploading(true);
    try {
      // 1. Descontar stock para cada producto
      for (const item of activeSaleItems) {
        if (!item.size) throw new Error(`Selecciona talla para ${item.name}`);
        const p = products.find(x => String(x.id) === String(item.id));
        if (p) {
          const newStock = { ...p.stock_by_size };
          newStock[item.size] = (parseInt(newStock[item.size]) || 0) - parseInt(item.quantity);
          const newTotal = Object.values(newStock).reduce((a, b) => a + (parseInt(b) || 0), 0);
          
          await fetch('/api/products', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...p, stock_by_size: newStock, stock_quantity: newTotal, imageURL: p.image_url })
          });
        }
      }

      // 2. Crear registro de venta única
      const totalAmount = activeSaleItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      
      // Si no hay cliente, buscar el ID de Público General
      let finalCustomerId = saleCustomerId || null;
      if (!finalCustomerId) {
        const pg = customers.find(c => c.name.toLowerCase().includes('público') && c.name.toLowerCase().includes('general'));
        if (pg) finalCustomerId = pg.id;
      }

      // Si el campo de pago está vacío, ahora es Cero (Deuda Full)
      const finalPaidAmount = salePaidAmount === '' ? 0 : parseFloat(salePaidAmount);

      if (finalPaidAmount < totalAmount) {
        if (!window.confirm(`⚠️ Esta venta generará una DEUDA de $${(totalAmount - finalPaidAmount).toFixed(0)} para el cliente. ¿Confirmar?`)) {
          setIsUploading(false);
          return;
        }
      }

      await fetch('/api/sales', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_id: finalCustomerId, 
          items: activeSaleItems, 
          total_amount: totalAmount, 
          paid_amount: finalPaidAmount || 0,
          profit: totalAmount * 0.3
        })
      });

      setActiveSaleItems([]); setSaleCustomerId(''); setSalePaidAmount('');
      fetchProducts(); fetchSales(); fetchCustomers(); setIsSaleOpen(false);
      alert("Venta registrada con éxito!");
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const handleGeneralAbono = async (customerId, amount) => {
    if (!amount || amount <= 0) return alert("Monto inválido");
    setIsUploading(true);
    try {
      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_id: customerId, 
          items: [{ name: "Abono a Cuenta General", quantity: 1, price: 0 }], 
          total_amount: 0, 
          paid_amount: parseFloat(amount), 
          profit: 0
        })
      });
      setGeneralAbonoAmount('');
      fetchCustomers(); fetchSales();
      alert('Abono registrado con éxito!');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const handleReservationPayment = async (reservation, amount, isFinal) => {
    if (!amount || amount <= 0) return alert("Monto inválido");
    setIsUploading(true);
    try {
      const newPaid = (parseFloat(reservation.paid_amount) || 0) + parseFloat(amount);
      const totalDue = parseFloat(reservation.price_at_reservation) * parseInt(reservation.quantity);
      const status = newPaid >= totalDue || isFinal ? 'Delivered' : 'Partial';

      if (!isTestMode) {
        // 1. Update Reservation
        await fetch('/api/reservations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reservation.id, paid_amount: newPaid, status })
        });

        // 2. Log Sale
        await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customer_id: reservation.customer_id, 
            items: JSON.stringify([{ name: reservation.product_name, q: reservation.quantity, size: reservation.product_size }]), 
            total_amount: totalDue, 
            paid_amount: amount, 
            profit: 0 // TODO: Calcular profit real
          })
        });
      } else {
        // Simulated update for UI
        setReservations(reservations.map(r => r.id === reservation.id ? { ...r, paid_amount: newPaid, status } : r));
      }

      fetchReservations(); fetchCustomers(); fetchSales();
      alert(status === 'Delivered' ? 'Entregado y pagado!' : 'Abono registrado');
      setPaymentAmount('');
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este cliente? Se borrará permanentemente.")) return;
    setIsUploading(true);
    try {
      await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      fetchCustomers();
    } catch (e) { alert(e.message); } finally { setIsUploading(false); }
  };

  const getSummaryForItems = (itemsList) => {
    const summary = {};
    itemsList.forEach(item => {
      const key = `${item.name}-${item.size}`;
      if (!summary[key]) summary[key] = { name: item.name, size: item.size, total: 0, cost: item.cost || 0, price: item.sale_price || 0, image_url: item.image_url };
      summary[key].total += parseInt(item.quantity);
    });
    return Object.values(summary);
  };

  const updateSummaryFinances = (name, size, field, value) => {
    setActiveOrderItems(prev => prev.map(i => (i.name === name && i.size === size) ? { ...i, [field]: parseFloat(value) || 0 } : i));
  };

  const downloadSummaryXLSX = async () => {
    const summary = getSummaryForItems(activeOrderItems);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Pedido');
    ws.columns = [{ header: 'Cant', key: 'q', width: 10 }, { header: 'Nombre', key: 'n', width: 40 }, { header: 'Talla', key: 's', width: 15 }, { header: 'Imagen', key: 'i', width: 20 }];
    for (let i = 0; i < summary.length; i++) {
      const g = summary[i];
      ws.addRow({ q: g.total, n: g.name, s: g.size });
      const row = ws.getRow(i + 2); row.height = 80; row.alignment = { vertical: 'middle', horizontal: 'center' };
      if (g.image_url) {
        try {
          const img = await fetch(g.image_url).then(r => r.arrayBuffer());
          const imgId = workbook.addImage({ buffer: img, extension: 'jpeg' });
          ws.addImage(imgId, { tl: { col: 3, row: i + 1 }, ext: { width: 100, height: 100 } });
        } catch(e) {}
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Pedido_${new Date().toISOString().split('T')[0]}.xlsx`; link.click();
  };

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
      <div className="glass" style={{ padding: '3rem', width: '350px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '2rem' }}>DEPORTUX ADMIN</h2>
        <form onSubmit={e => { e.preventDefault(); if (loginData.user === 'admin' && loginData.password === 'Anitalavalatin4') { setIsAuthenticated(true); sessionStorage.setItem('isAdminAuthenticated', 'true'); fetchProducts(); fetchOrdersHistory(); fetchCustomers(); fetchSales(); } else alert('Credenciales incorrectas'); }} style={{ display: 'grid', gap: '1rem' }}>
          <input type="text" placeholder="Usuario" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, user: e.target.value})} />
          <input type="password" placeholder="Contraseña" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, password: e.target.value})} />
          <button type="submit" className="btn btn-primary" style={{ padding: '1rem' }}>Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-page-container">
      <Loader show={loading || isUploading} />
      <style>{`
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tab-btn { padding: 1rem 2rem; background: rgba(255,255,255,0.03); border: none; color: white; cursor: pointer; border-radius: 12px 12px 0 0; font-weight: bold; transition: 0.3s; }
        .tab-btn.active { background: var(--primary); }
        .floating-order { position: fixed; top: 0; right: 0; height: 100vh; width: 400px; z-index: 1000; background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px); border-left: 1px solid rgba(255,255,255,0.1); padding: 2rem; transition: 0.3s; box-shadow: -10px 0 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
        .floating-order.collapsed { transform: translateX(100%); }
        .floating-sale { position: fixed; top: 0; left: 0; height: 100vh; width: 400px; z-index: 1000; background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px); border-right: 1px solid rgba(255,255,255,0.1); padding: 2rem; transition: 0.3s; box-shadow: 10px 0 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
        .floating-sale.collapsed { transform: translateX(-100%); }
        .toggle-btn { position: fixed; top: 50%; z-index: 1001; background: var(--primary); color: white; padding: 1.5rem 0.6rem; border-radius: 12px 0 0 12px; cursor: pointer; writing-mode: vertical-rl; transform: translateY(-50%); font-weight: bold; }
        .order-toggle { right: 0; border-radius: 12px 0 0 12px; }
        .sale-toggle { left: 0; border-radius: 0 12px 12px 0; background: #10b981; }

        /* Visibilidad Mejorada */
        input::placeholder { color: rgba(255,255,255,0.5) !important; }
        input, select, textarea { color: white !important; }
        select option { background: #1e293b; color: white; }
        .glass input, .glass select { border: 1px solid rgba(255,255,255,0.2) !important; }
        
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .customer-card { background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        
        /* Animations */
        @keyframes pulse-check {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .animate-check { animation: pulse-check 0.3s ease-out; }
        .item-row { transition: all 0.3s ease; }
        .item-row.received { background: rgba(16, 185, 129, 0.08) !important; border-color: #10b981 !important; }

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
      `}</style>
      
      <header className="admin-header">
        <img src="/logo.png" alt="Logo" style={{ height: '60px' }} />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/" className="btn glass">Ver Tienda</Link>
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} className="btn" style={{ background: '#ef4444' }}>Cerrar Sesión</button>
        </div>
      </header>

      {isTestMode && (
        <div style={{ background: '#22c55e', color: 'white', padding: '0.5rem', textAlign: 'center', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
          ⚠️ USANDO DATASET DE PRUEBAS LOCAL. Los cambios no se guardarán en la base de datos de producción.
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>📦 INVENTARIO</button>
        <button className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>👥 CLIENTES</button>
        <button className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>💰 VENTAS</button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 HISTORIAL PROV</button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ CONFIG</button>
      </div>

      <main>
        {activeTab === 'inventory' && (
          <div className="admin-main-grid">
            <div className="admin-content-area">
              <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                <form onSubmit={handleCatalogSubmit} className="admin-form-grid">
                  <input type="text" placeholder="Nombre al Uniforme" required className="glass" style={{ padding: '1rem', width: '100%' }} value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                  <div style={{ margin: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)' }}>Tallas y Existencias:</label>
                      <button type="button" onClick={() => setNewProduct({...newProduct, size: '', stock_by_size: {}})} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}>Borrar todas</button>
                    </div>
                    <div className="tallas-grid">
                      {(availableSizes[newProduct.category] || []).map(size => {
                        const qty = (newProduct.stock_by_size && newProduct.stock_by_size[size]) || 0;
                        const isSelected = qty > 0 || (newProduct.size && newProduct.size.split(',').map(s => s.trim()).includes(size));
                        return (
                          <div 
                            key={size} 
                            className={`glass ${isSelected ? 'active' : ''}`}
                            style={{ padding: '0.8rem', borderRadius: '12px', border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(239, 129, 30, 0.05)' : 'none', transition: '0.2s' }}
                          >
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span>{size}</span>
                              {isSelected && <span style={{ color: 'var(--primary)' }}>✓</span>}
                            </div>
                            <input 
                              type="number" 
                              placeholder="0" 
                              min="0"
                              className="glass" 
                              style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', textAlign: 'center' }}
                              value={(newProduct.stock_by_size && newProduct.stock_by_size[size]) || 0}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0;
                                const nextStock = { ...(newProduct.stock_by_size || {}), [size]: val };
                                // Re-calculate size string based on what has stock
                                const activeSizes = Object.entries(nextStock).filter(([_, v]) => v > 0).map(([k]) => k);
                                setNewProduct({
                                  ...newProduct, 
                                  stock_by_size: nextStock,
                                  size: activeSizes.join(', ')
                                });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="admin-form-row">
                    <select 
                      className="glass" 
                      style={{ padding: '1rem', background: 'var(--bg-color)', width: '100%' }} 
                      value={newProduct.category} 
                      onChange={e => setNewProduct({...newProduct, category: e.target.value, size: '', stock_by_size: {}})}
                    >
                      <option value="Adulto">Adulto</option>
                      <option value="Niño">Niño</option>
                    </select>
                  </div>
                  <div className="admin-form-row">
                    <input type="number" placeholder="Precio ($)" className="glass" style={{ padding: '1rem', width: '100%' }} value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                    <input type="file" className="glass" style={{ padding: '0.8rem', width: '100%' }} onChange={e => setNewProduct({...newProduct, image: e.target.files[0]})} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '1.1rem', width: '100%', fontSize: '1rem' }}>{editingId ? 'Actualizar' : 'Guardar'}</button>
                </form>
              </section>

              {/* Filtros de Inventario Admin */}
              <div style={{ marginBottom: '2rem', display: 'grid', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar en inventario..." 
                  className="glass" 
                  style={{ width: '100%', padding: '1rem' }} 
                  value={adminSearchQuery} 
                  onChange={e => setAdminSearchQuery(e.target.value)} 
                />
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: '🏟️ Todos', color: 'var(--primary)' },
                    { id: 'favorites', label: '✨ Favoritos', color: '#fbbf24' },
                    { id: 'stock', label: '📦 En Stock', color: '#10b981' },
                    { id: 'order', label: '🚚 Bajo Pedido', color: '#60a5fa' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setAdminFilterType(f.id)}
                      className="glass"
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '99px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        border: `1px solid ${adminFilterType === f.id ? f.color : 'rgba(255,255,255,0.1)'}`,
                        background: adminFilterType === f.id ? `${f.color}22` : 'transparent',
                        color: adminFilterType === f.id ? f.color : 'white',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {['Niño', 'Adulto'].map(cat => (
                <div key={cat} style={{ marginBottom: '1.5rem' }}>
                  <div onClick={() => setOpenCategory(openCategory === cat ? null : cat)} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0 }}>{cat.toUpperCase()} ({products.filter(p => {
                      const matchesCategory = (cat === 'Adulto' ? (!p.category || p.category === 'Adulto') : p.category === cat);
                      const matchesSearch = p.name.toLowerCase().includes(adminSearchQuery.toLowerCase());
                      let matchesFilter = true;
                      if (adminFilterType === 'favorites') matchesFilter = p.is_favorite;
                      if (adminFilterType === 'stock') matchesFilter = p.type === 'stock';
                      if (adminFilterType === 'order') matchesFilter = p.type === 'order';
                      return matchesCategory && matchesSearch && matchesFilter;
                    }).length})</h4>
                    <span>{openCategory === cat ? '▲' : '▼'}</span>
                  </div>
                  {(openCategory === cat || adminSearchQuery !== '' || adminFilterType !== 'all') && (
                    <div className="admin-grid">
                      {products.filter(p => {
                        const matchesCategory = (cat === 'Adulto' ? (!p.category || p.category === 'Adulto') : p.category === cat);
                        const matchesSearch = p.name.toLowerCase().includes(adminSearchQuery.toLowerCase());
                        let matchesFilter = true;
                        if (adminFilterType === 'favorites') matchesFilter = p.is_favorite;
                        if (adminFilterType === 'stock') matchesFilter = p.type === 'stock';
                        if (adminFilterType === 'order') matchesFilter = p.type === 'order';
                        return matchesCategory && matchesSearch && matchesFilter;
                      }).map(p => (
                        <AdminItem key={p.id} p={p} onAdd={addToOrderList} onDelete={handleDelete} onEdit={handleEdit} onSell={addToSaleList} onHover={setHoveredImage} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <aside className="admin-sidebar glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>📋 Resumen para Proveedor</h4>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {getSummaryForItems(activeOrderItems).map((g, i) => (
                  <div key={i} style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{g.total}x {g.name}</strong> <span>{g.size}</span></div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      <input type="number" className="glass" style={{ width: '100%', padding: '0.2rem' }} value={g.cost} onChange={e => updateSummaryFinances(g.name, g.size, 'cost', e.target.value)} title="Costo" />
                      <input type="number" className="glass" style={{ width: '100%', padding: '0.2rem' }} value={g.price} onChange={e => updateSummaryFinances(g.name, g.size, 'sale_price', e.target.value)} title="Venta" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={downloadSummaryXLSX} className="btn" style={{ width: '100%', marginTop: '1rem', background: '#10b981' }}>Excel Proveedor</button>
            </aside>
          </div>
        )}

        {activeTab === 'customers' && (
          selectedCustomerId ? (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.95)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
              <div className="glass" style={{ width: '95%', maxWidth: '900px', height: '90vh', padding: '2.5rem', overflowY: 'auto', border: '1px solid var(--primary)', position: 'relative', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
                <button onClick={() => setSelectedCustomerId(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}>×</button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--primary)' }}>{customers.find(c => c.id === selectedCustomerId)?.name}</h2>
                    <p style={{ opacity: 0.6, margin: '5px 0 0 0' }}>📱 {customers.find(c => c.id === selectedCustomerId)?.phone}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>DEUDA TOTAL</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f87171' }}>${parseFloat(customers.find(c => c.id === selectedCustomerId)?.balance || 0).toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div>
                    <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>📦 Apartados Pendientes <span style={{ background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>{reservations.filter(r => r.customer_id === selectedCustomerId && r.status !== 'Delivered').length}</span></h4>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {reservations.filter(r => r.customer_id === selectedCustomerId && r.status !== 'Delivered').map(r => (
                        <div key={r.id} className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <img src={r.image_url} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px' }} alt="" />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold' }}>{r.product_name}</div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Talla: {r.product_size} | Cant: {r.quantity}</div>
                              <div style={{ marginTop: '5px', fontSize: '0.9rem' }}>
                                Total: <strong>${(r.price_at_reservation * r.quantity).toFixed(0)}</strong> | 
                                Pagado: <span style={{ color: '#4ade80' }}>${parseFloat(r.paid_amount || 0).toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                            <input type="number" placeholder="Monto" className="glass" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                            <button onClick={() => handleReservationPayment(r, paymentAmount, false)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Abonar</button>
                            <button onClick={() => handleReservationPayment(r, (r.price_at_reservation * r.quantity) - (r.paid_amount || 0), true)} className="btn" style={{ padding: '0.5rem 1rem', background: '#10b981', fontSize: '0.8rem' }}>Liquidar</button>
                          </div>
                        </div>
                      ))}
                      {reservations.filter(r => r.customer_id === selectedCustomerId && r.status !== 'Delivered').length === 0 && (
                        <p style={{ opacity: 0.5, textAlign: 'center', marginTop: '2rem' }}>No hay apartados pendientes.</p>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>💰 Saldo Pendiente:</span>
                        <strong style={{ color: parseFloat(customers.find(c => c.id === selectedCustomerId)?.balance || 0) > 0 ? '#f87171' : '#4ade80', fontSize: '1.8rem' }}>
                          ${parseFloat(customers.find(c => c.id === selectedCustomerId)?.balance || 0).toFixed(0)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
                        <input 
                          type="number" 
                          placeholder="Monto de Abono General" 
                          className="glass" 
                          style={{ flex: 1, padding: '0.8rem', fontSize: '1rem' }} 
                          value={generalAbonoAmount} 
                          onChange={e => setGeneralAbonoAmount(e.target.value)} 
                        />
                        <button 
                          onClick={() => handleGeneralAbono(selectedCustomerId, generalAbonoAmount)} 
                          className="btn" 
                          style={{ background: '#10b981', padding: '0 2rem' }}
                        >
                          ABONAR A DEUDA
                        </button>
                      </div>
                    </div>

                    <h4 style={{ marginBottom: '1.5rem' }}>💰 Historial de Compras y Pagos</h4>
                    <div style={{ display: 'grid', gap: '1rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {sales.filter(s => s.customer_id === selectedCustomerId).map(s => {
                        const items = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');
                        const isPaymentOnly = s.total_amount === "0.00" || s.total_amount === 0;
                        return (
                          <div key={s.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                                <select 
                                  className="glass" 
                                  style={{ background: '#0f172a', padding: '0.2rem 0.5rem', fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                  value={s.customer_id || ''}
                                  onChange={(e) => handleReassignSale(s.id, e.target.value)}
                                >
                                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button 
                                  onClick={() => handleReturnSale(s.id)} 
                                  className="btn glass" 
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' }}
                                  title="Procesar Devolución"
                                >
                                  ↩️ Devolución
                                </button>
                              </div>
                              <span style={{ color: isPaymentOnly ? '#10b981' : (parseFloat(s.total_amount) > parseFloat(s.paid_amount) ? '#f87171' : '#4ade80'), fontWeight: 'bold' }}>
                                {isPaymentOnly ? `Abono: +$${parseFloat(s.paid_amount).toFixed(0)}` : `Venta: $${parseFloat(s.total_amount).toFixed(0)}`}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {items.map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                  <span>{it.quantity}x {it.name} {it.size ? <small style={{ opacity: 0.6 }}>({it.size})</small> : ''}</span>
                                  <span style={{ opacity: 0.7 }}>{it.price > 0 ? `$${(parseFloat(it.price) * parseInt(it.quantity)).toFixed(0)}` : ''}</span>
                                </div>
                              ))}
                              {!isPaymentOnly && parseFloat(s.paid_amount) < parseFloat(s.total_amount) && (
                                <div style={{ marginTop: '0.5rem', padding: '0.4rem', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '6px', fontSize: '0.8rem', color: '#f87171', textAlign: 'right' }}>
                                  Faltante: -${(parseFloat(s.total_amount) - parseFloat(s.paid_amount)).toFixed(0)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div className="glass" style={{ gridColumn: '1 / -1', padding: '1.5rem' }}>
                <h4>➕ Nuevo Cliente</h4>
                <form onSubmit={async e => { 
                  e.preventDefault(); 
                  await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCustomer) }); 
                  setNewCustomer({name:'', phone:''}); 
                  fetchCustomers(); 
                }} className="customer-form">
                  <input type="text" placeholder="Nombre" required className="glass" style={{ flex: 2, padding: '0.8rem' }} value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                  <input type="text" placeholder="WhatsApp" className="glass" style={{ flex: 1, padding: '0.8rem' }} value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                  <button type="submit" className="btn btn-primary">Registrar</button>
                </form>
              </div>
              {customers.map(c => (
                <div key={c.id} className="customer-card">
                  <h4 style={{ margin: 0 }}>{c.name}</h4>
                  <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>📱 {c.phone}</p>
                  <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Saldo Pendiente:</span>
                    <strong style={{ color: parseFloat(c.balance || 0) > 0 ? '#f87171' : '#4ade80', fontSize: '1.1rem' }}>${parseFloat(c.balance || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button onClick={() => setSelectedCustomerId(c.id)} className="btn glass" style={{ flex: 1, fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>VER DETALLES / ABONAR</button>
                    <button onClick={() => handleDeleteCustomer(c.id)} className="btn glass" style={{ width: '45px', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' }} title="Eliminar Cliente">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'sales' && (
          <div className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>🎯 Historial Global de Ventas</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {sales.map(s => {
                const items = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');
                return (
                  <div key={s.id} className="glass" style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select 
                          className="glass" 
                          style={{ background: '#0f172a', padding: '0.4rem', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                          value={s.customer_id || ''}
                          onChange={(e) => handleReassignSale(s.id, e.target.value)}
                        >
                          <option value="">🛒 Venta Local</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button 
                          onClick={() => handleReturnSale(s.id)} 
                          className="btn glass" 
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' }}
                        >
                          ↩️ Devolución
                        </button>
                        <span style={{ opacity: 0.4, fontSize: '0.7rem' }}>#{s.id} | {new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                        {items.map((it, i) => <span key={i}>{i > 0 && ', '}{it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}</span>)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>${parseFloat(s.total_amount).toFixed(0)}</div>
                      <div style={{ color: '#4ade80', fontSize: '0.75rem' }}>Abonado: ${parseFloat(s.paid_amount).toFixed(0)}</div>
                      {parseFloat(s.total_amount) > parseFloat(s.paid_amount) && (
                        <div style={{ color: '#f87171', fontSize: '0.75rem' }}>Deuda: -${(parseFloat(s.total_amount) - parseFloat(s.paid_amount)).toFixed(0)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {ordersHistory.map(o => (
              <div key={o.id} className="glass" style={{ padding: '1.5rem', borderLeft: `5px solid ${o.is_entered ? '#10b981' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Pedido #{o.id} {o.is_entered && '✅'}</div>
                    <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {!o.is_entered && (
                      <button 
                        onClick={() => handleReceiveIntoInventory(o)} 
                        disabled={!(Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')).some(it => it.received)}
                        className="btn btn-primary" 
                        style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', opacity: (Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')).some(it => it.received) ? 1 : 0.5 }}
                      >
                        📦 INGRESAR A INVENTARIO
                      </button>
                    )}
                    <button className="btn glass" onClick={() => setExpandedHistory(expandedHistory === o.id ? null : o.id)}>{expandedHistory === o.id ? 'Ocultar' : 'Detalles'}</button>
                  </div>
                </div>
                {expandedHistory === o.id && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', fontSize: '0.9rem' }}>
                    {!o.is_entered && (
                      <div style={{ marginBottom: '1rem' }}>
                        <button onClick={() => markAllAsReceived(o)} className="btn glass" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
                          ✅ Marcar todo como recibido
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                      {(Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')).map((it, idx) => (
                        <div 
                          key={idx} 
                          className={`item-row ${it.received ? 'received' : ''} ${it.received ? 'animate-check' : ''}`}
                          style={{ 
                            background: 'rgba(255,255,255,0.02)', 
                            padding: '0.8rem', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            transition: '0.3s' 
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div 
                              onClick={() => !o.is_entered && toggleOrderItemReceived(o, idx)}
                              style={{ 
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '6px', 
                                border: `2px solid ${it.received ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                                background: it.received ? '#10b981' : 'transparent',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: o.is_entered ? 'default' : 'pointer',
                                transition: '0.2s'
                              }}
                            >
                              {it.received && <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>✓</span>}
                            </div>
                            <div style={{ flex: 1, opacity: it.received ? 1 : 0.6 }}>
                              <div style={{ fontWeight: 'bold', textDecoration: it.received ? 'line-through' : 'none', color: it.received ? '#10b981' : 'white' }}>{it.quantity}x {it.name}</div>
                              <div style={{ fontSize: '0.75rem' }}>{it.size} | {it.is_apartado ? '✨ Apartado' : 'Stock'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="glass" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '2rem' }}>⚙️ Configuración de Tallas</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
              {/* ADULTO */}
              <section>
                <h4 style={{ marginBottom: '1rem', color: '#60a5fa' }}>👨 Tallas Adulto</h4>
                <div className="size-selector-grid" style={{ marginBottom: '1.5rem' }}>
                  {(availableSizes.Adulto || []).map(size => (
                    <div key={`a-${size}`} style={{ position: 'relative', display: 'inline-block' }}>
                      <span className="size-tag active" style={{ paddingRight: '2.5rem' }}>{size}</span>
                      <button 
                        onClick={() => setAvailableSizes(prev => ({ ...prev, Adulto: prev.Adulto.filter(s => s !== size) }))}
                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <form 
                  onSubmit={e => {
                    e.preventDefault();
                    const val = e.target.newSize.value.trim().toUpperCase();
                    if (val && !availableSizes.Adulto.includes(val)) {
                      setAvailableSizes(prev => ({ ...prev, Adulto: [...prev.Adulto, val] }));
                      e.target.newSize.value = '';
                    }
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
                >
                  <input name="newSize" type="text" placeholder="Ej: XXL" className="glass" style={{ padding: '0.6rem', flex: 1 }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>+</button>
                </form>
              </section>

              {/* NIÑO */}
              <section>
                <h4 style={{ marginBottom: '1rem', color: '#f472b6' }}>🧒 Tallas Niño</h4>
                <div className="size-selector-grid" style={{ marginBottom: '1.5rem' }}>
                  {(availableSizes.Niño || []).map(size => (
                    <div key={`n-${size}`} style={{ position: 'relative', display: 'inline-block' }}>
                      <span className="size-tag active" style={{ paddingRight: '2.5rem', background: '#f472b6', borderColor: '#f472b6' }}>{size}</span>
                      <button 
                        onClick={() => setAvailableSizes(prev => ({ ...prev, Niño: prev.Niño.filter(s => s !== size) }))}
                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <form 
                  onSubmit={e => {
                    e.preventDefault();
                    const val = e.target.newSize.value.trim().toUpperCase();
                    if (val && !availableSizes.Niño.includes(val)) {
                      setAvailableSizes(prev => ({ ...prev, Niño: [...prev.Niño, val] }));
                      e.target.newSize.value = '';
                    }
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
                >
                  <input name="newSize" type="text" placeholder="Ej: 10" className="glass" style={{ padding: '0.6rem', flex: 1 }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', background: '#f472b6' }}>+</button>
                </form>
              </section>

              <div style={{ padding: '1rem', background: 'rgba(239, 129, 30, 0.1)', border: '1px solid var(--primary)', borderRadius: '12px', fontSize: '0.85rem', marginTop: '2.5rem' }}>
                <strong>Nota:</strong> Al eliminar una talla de aquí, no se borrará de los productos existentes, pero ya no aparecerá como opción para nuevos productos de esa categoría.
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="toggle-btn sale-toggle" onClick={() => setIsSaleOpen(!isSaleOpen)} style={{ background: '#10b981' }}>{isSaleOpen ? 'CERRAR ➔' : '💰 VENTA ACTUAL'}</div>
      <div className="toggle-btn order-toggle" onClick={() => setIsOrderOpen(!isOrderOpen)} style={{ right: 0 }}>{isOrderOpen ? 'CERRAR ➔' : '🛒 PEDIDO PROV'}</div>
      
      {/* BARRA LATERAL: VENTA ACTUAL (IZQUIERDA) */}
      <aside className={`floating-sale ${isSaleOpen ? '' : 'collapsed'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3>Venta Directa 💰</h3>
          <button onClick={() => setIsSaleOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '2rem' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeSaleItems.map(item => (
            <div key={item.saleId} className="glass" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                <button onClick={() => setActiveSaleItems(activeSaleItems.filter(i => i.saleId !== item.saleId))} style={{ color: '#ef4444', border: 'none', background: 'none' }}>×</button>
              </div>
              
              <div className="cart-item-grid">
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Talla:</label>
                  <select 
                    className="glass" 
                    style={{ padding: '0.4rem', background: '#0f172a' }} 
                    value={item.size} 
                    onChange={e => updateSaleItem(item.saleId, { size: e.target.value })}
                  >
                    <option value="">Talla</option>
                    {Object.keys(item.stock_by_size).filter(s => item.stock_by_size[s] > 0).map(s => (
                      <option key={s} value={s}>{s} ({item.stock_by_size[s]})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Cant:</label>
                  <input 
                    type="number" 
                    className="glass" 
                    style={{ padding: '0.4rem' }} 
                    value={item.quantity} 
                    onChange={e => updateSaleItem(item.saleId, { quantity: parseInt(e.target.value) })} 
                    min="1" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Precio Uni:</label>
                  <input 
                    type="number" 
                    className="glass" 
                    style={{ padding: '0.4rem' }} 
                    value={item.price} 
                    onChange={e => updateSaleItem(item.saleId, { price: parseFloat(e.target.value) })} 
                    placeholder="Precio" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Total:</label>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toFixed(0)}</div>
                </div>
              </div>
            </div>
          ))}

          {activeSaleItems.length === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.4, marginTop: '4rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
              <p>Tu carrito de venta está vacío.</p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>Cliente (Opcional):</label>
            <select className="glass" style={{ width: '100%', padding: '0.8rem', background: '#0f172a' }} value={saleCustomerId} onChange={e => setSaleCustomerId(e.target.value)}>
              <option value="">🛒 Público General / Local</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>Efectivo Recibido:</label>
            <input 
              type="number" 
              className="glass" 
              style={{ width: '100%', padding: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }} 
              value={salePaidAmount} 
              onChange={e => setSalePaidAmount(e.target.value)} 
              placeholder={activeSaleItems.reduce((acc, i) => acc + (parseFloat(i.price || 0) * parseInt(i.quantity || 0)), 0).toFixed(0)} 
            />
            {(() => {
              const total = activeSaleItems.reduce((acc, i) => acc + (parseFloat(i.price || 0) * parseInt(i.quantity || 0)), 0);
              const paid = parseFloat(salePaidAmount || 0);
              const pgCustomer = customers.find(c => c.name.toLowerCase().includes('público en general') || c.name.toLowerCase().includes('público general'));
              const isPublic = !saleCustomerId || (pgCustomer && String(saleCustomerId) === String(pgCustomer.id));

              if (isPublic && paid < total && salePaidAmount !== '') {
                return <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '5px' }}>⚠️ Público General debe pagar el total (${total.toFixed(0)}).</div>;
              }
              if (!isPublic && paid < total) {
                return <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '5px' }}>* El resto (${(total - paid).toFixed(0)}) se cargará al saldo del cliente.</div>;
              }
              return null;
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
            <span>TOTAL:</span>
            <span style={{ color: 'var(--primary)' }}>${activeSaleItems.reduce((acc, i) => acc + (parseFloat(i.price || 0) * parseInt(i.quantity || 0)), 0).toFixed(0)}</span>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', padding: '1.2rem', background: '#10b981' }} onClick={handleFinalizeSale} disabled={isUploading || activeSaleItems.length === 0}>
            {isUploading ? 'Procesando...' : '💰 CONFIRMAR VENTA'}
          </button>
        </div>
      </aside>
      
      <aside className={`floating-order ${isOrderOpen ? '' : 'collapsed'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3>Pedido a Proveedor 🛒</h3>
          <button onClick={() => setIsOrderOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '2rem' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeOrderItems.map(item => (
            <div key={item.orderId} className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                <button onClick={() => setActiveOrderItems(activeOrderItems.filter(i => i.orderId !== item.orderId))} style={{ color: '#ef4444', border: 'none', background: 'none' }}>×</button>
              </div>
              <div className="order-item-grid">
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Cant:</label>
                  <input type="number" className="glass" style={{ padding: '0.4rem' }} value={item.quantity} onChange={e => updateOrderItem(item.orderId, { quantity: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Talla:</label>
                  <select className="glass" style={{ padding: '0.4rem', background: '#0f172a', color: 'white' }} value={item.size} onChange={e => updateOrderItem(item.orderId, { size: e.target.value })}>
                    <option value="">Talla</option>
                    {(availableSizes[item.category] || []).map(s => <option key={`${item.category}-${s}`} value={s}>{s}</option>)}
                    {item.size && !availableSizes[item.category]?.includes(item.size) && !item.size.includes(',') && (
                      <option value={item.size}>{item.size}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>Precio Venta:</label>
                  <input type="number" className="glass" style={{ padding: '0.4rem' }} value={item.sale_price} onChange={e => updateOrderItem(item.orderId, { sale_price: parseFloat(e.target.value) })} placeholder="Venta" />
                </div>
              </div>
              <div style={{ marginTop: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={item.is_apartado} onChange={e => updateOrderItem(item.orderId, { is_apartado: e.target.checked })} /> ✨ Es Apartado
                </label>
                {item.is_apartado && (
                  <select className="glass" style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', fontSize: '0.8rem', background: '#0f172a' }} value={item.customer_id || ''} onChange={e => updateOrderItem(item.orderId, { customer_id: e.target.value })}>
                    <option value="">Seleccionar Cliente</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            <span>Total Sugerido:</span>
            <span>${activeOrderItems.reduce((acc, i) => acc + (i.sale_price * i.quantity), 0).toFixed(0)}</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: '1.2rem' }} onClick={handleFinalizeOrder} disabled={isUploading}>
            {isUploading ? 'Finalizando...' : 'FINALIZAR E INGRESAR 🚀'}
          </button>
        </div>
      </aside>

      {hoveredImage && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, background: 'rgba(0,0,0,0.9)', padding: '1rem', borderRadius: '12px', border: '2px solid var(--primary)', pointerEvents: 'none' }}>
          <img src={hoveredImage} style={{ maxWidth: '400px', maxHeight: '400px', borderRadius: '8px' }} alt="" />
        </div>
      )}
    </div>
  );
};

const AdminItem = ({ p, onAdd, onDelete, onEdit, onSell, onHover }) => (
  <div className="glass" style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
    <div style={{ aspectRatio: '1/1', overflow: 'hidden', borderRadius: '8px', position: 'relative' }}>
      <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onMouseEnter={() => onHover(p.image_url)} onMouseLeave={() => onHover(null)} />
      <div style={{ position: 'absolute', top: 5, left: 5, padding: '2px 8px', borderRadius: '4px', background: p.stock_quantity > 0 ? '#10b981' : '#f59e0b', color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>{p.stock_quantity > 0 ? `STK: ${p.stock_quantity}` : 'PEDIDO'}</div>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>#{p.short_id}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{p.name}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{p.size} | ${parseFloat(p.price).toFixed(2)}</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
      <button onClick={() => onAdd(p)} title="Agregar a pedido a proveedor" className="btn btn-primary" style={{ padding: '0.5rem' }}>ORDEN +</button>
      <button onClick={() => onSell(p)} title="Realizar venta inmediata" className="btn" style={{ padding: '0.5rem', background: '#10b981', color: 'white' }}>VENDER</button>
      <button onClick={() => onEdit(p)} className="btn glass" style={{ fontSize: '0.7rem' }}>EDITAR</button>
      <button onClick={() => onDelete(p.id)} className="btn glass" style={{ fontSize: '0.7rem', color: '#ff4444' }}>BORRAR</button>
    </div>
  </div>
);

export default AdminDashboard;
