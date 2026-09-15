import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  Plus, 
  Search,
  Calendar,
  DollarSign,
  User,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { salesService } from '@/services/salesService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  stock: number;
}

interface Sale {
  id: string;
  seller_id: string;
  client_id: string;
  product_id: string;
  quantity: number;
  sale_date: string;
  total_amount: number;
  product?: Product;
  client?: { name: string; phone: string };
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

export default function Sales() {
  const { user } = useAuth();
  const { hasPermission, isAdmin } = useUserPermissions();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);

  // Permisos específicos de ventas
  const canCreateSales = isAdmin || hasPermission('puede_crear_ventas');
  const canEditSales = isAdmin || hasPermission('puede_editar_ventas');
  const canDeleteSales = isAdmin || hasPermission('puede_eliminar_ventas');
  
  const [newSale, setNewSale] = useState({
    seller_id: user?.id || '',
    client_id: '',
    product_id: '',
    quantity: 1,
    sale_date: new Date().toISOString().split('T')[0],
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    description: '',
    stock: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [salesData, productsData, leadsData] = await Promise.all([
        salesService.getSales(user.id),
        salesService.getProducts(user.id),
        salesService.getLeads(user.id),
      ]);
      
      setSales(salesData);
      setProducts(productsData);
      setLeads(leadsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSale = async () => {
    if (!user?.id || !newSale.client_id || !newSale.product_id || newSale.quantity <= 0) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    const product = products.find(p => p.id === newSale.product_id);
    if (!product) {
      toast.error('Producto no encontrado');
      return;
    }

    if (product.stock < newSale.quantity) {
      toast.error('Stock insuficiente');
      return;
    }

    const total_amount = product.price * newSale.quantity;

    try {
      await salesService.createSale({
        ...newSale,
        user_id: user.id,
        total_amount,
      });

      toast.success('Venta creada exitosamente');
      setIsNewSaleOpen(false);
      setNewSale({
        seller_id: user.id,
        client_id: '',
        product_id: '',
        quantity: 1,
        sale_date: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (error) {
      console.error('Error creating sale:', error);
      toast.error('Error al crear la venta');
    }
  };

  const handleCreateProduct = async () => {
    if (!user?.id || !newProduct.name || newProduct.price <= 0) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      await salesService.createProduct({
        ...newProduct,
        user_id: user.id,
      });

      toast.success('Producto creado exitosamente');
      setIsNewProductOpen(false);
      setNewProduct({
        name: '',
        price: 0,
        description: '',
        stock: 0,
      });
      loadData();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error al crear el producto');
    }
  };

  const calculateTotal = () => {
    const product = products.find(p => p.id === newSale.product_id);
    return product ? product.price * newSale.quantity : 0;
  };

  const filteredSales = sales.filter(sale =>
    sale.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Ventas</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ventas" className="w-full">
        <div className="border-b border-border bg-card px-4">
          <TabsList className="bg-transparent border-0">
            <TabsTrigger 
              value="ventas" 
              className="data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ventas
            </TabsTrigger>
            <TabsTrigger 
              value="productos" 
              className="data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Package className="h-4 w-4 mr-2" />
              Productos {products.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">{products.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Ventas Tab */}
        <TabsContent value="ventas" className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <h2 className="text-xl font-semibold text-foreground">Lista de Ventas</h2>
            </div>
            
            <p className="text-muted-foreground">Gestiona todas tus ventas realizadas</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <Button 
                onClick={() => setIsNewSaleOpen(true)}
                className="bg-[#f97316] hover:bg-[#ea580c] text-white"
                disabled={!canCreateSales}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Venta
              </Button>

              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ventas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-muted/50"
                />
              </div>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Cargando ventas...</p>
                </CardContent>
              </Card>
            ) : filteredSales.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">No hay ventas registradas</h3>
                    <p className="text-muted-foreground">Comienza creando tu primera venta</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSales.map((sale) => (
                  <Card key={sale.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        {sale.product?.name || 'Producto'}
                      </CardTitle>
                      <CardDescription>
                        {sale.client?.name || 'Cliente'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Cantidad:</span>
                        <span className="font-medium">{sale.quantity}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total:</span>
                        <span className="font-bold text-lg text-[#f97316]">
                          ${sale.total_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                        <span>{format(new Date(sale.sale_date), 'dd/MM/yyyy', { locale: es })}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Productos Tab */}
        <TabsContent value="productos" className="p-6 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Lista de Productos</h2>
            <p className="text-muted-foreground">Gestiona tu inventario de productos</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <Button 
                onClick={() => setIsNewProductOpen(true)}
                className="bg-[#f97316] hover:bg-[#ea580c] text-white"
                disabled={!canCreateSales}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>

              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-muted/50"
                />
              </div>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Cargando productos...</p>
                </CardContent>
              </Card>
            ) : filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">No hay productos registrados</h3>
                    <p className="text-muted-foreground">Comienza agregando tu primer producto</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {product.description && (
                        <CardDescription>{product.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Precio:</span>
                        <span className="font-bold text-lg text-[#f97316]">
                          ${product.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Stock:</span>
                        <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.stock} unidades
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Nueva Venta */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Nueva Venta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seller" className="text-foreground">Vendedor *</Label>
                <Select value={newSale.seller_id} onValueChange={(value) => setNewSale({ ...newSale, seller_id: value })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Seleccionar Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.id || ''}>
                      {user?.email || 'Usuario actual'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client" className="text-foreground">Cliente *</Label>
                <Select value={newSale.client_id} onValueChange={(value) => setNewSale({ ...newSale, client_id: value })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Seleccionar Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} - {lead.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product" className="text-foreground">Producto *</Label>
              <Select value={newSale.product_id} onValueChange={(value) => setNewSale({ ...newSale, product_id: value })}>
                <SelectTrigger className="bg-background border-2 border-[#f97316]">
                  <SelectValue placeholder="Seleccionar Producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.price.toFixed(2)} (Stock: {product.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-foreground">Cantidad *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newSale.quantity}
                  onChange={(e) => setNewSale({ ...newSale, quantity: parseInt(e.target.value) || 1 })}
                  placeholder="Cantidad vendida"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_date" className="text-foreground">Fecha de Venta *</Label>
                <Input
                  id="sale_date"
                  type="date"
                  value={newSale.sale_date}
                  onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-foreground">Monto a pagar:</span>
                <span className="text-2xl font-bold text-[#f97316]">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNewSaleOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateSale}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              CREAR VENTA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Producto */}
      <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Nuevo Producto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Nombre *</Label>
              <Input
                id="name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Nombre del producto"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-foreground">Precio *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock" className="text-foreground">Stock</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                placeholder="Cantidad en inventario"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Descripción</Label>
              <Input
                id="description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Descripción del producto"
                className="bg-background"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNewProductOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateProduct}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}