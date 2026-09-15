import React, { useState, useEffect } from 'react';
import { Tag, Edit2, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { tagsServices, EtiquetaResponse, EtiquetaData } from '@/services/tagsServices';

export default function TagsTab() {
    const [etiquetas, setEtiquetas] = useState<EtiquetaResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingEtiqueta, setEditingEtiqueta] = useState<EtiquetaResponse | null>(null);
    const [etiquetaToDelete, setEtiquetaToDelete] = useState<EtiquetaResponse | null>(null);
    const [formData, setFormData] = useState<EtiquetaData>({
        nombre: '',
        color: '#10b981',
        descripcion: ''
    });
    const { toast } = useToast();

    // Paleta de colores completa como en la referencia
    const coloresPredefinidos = [
        // Row 1 - Greens & Blues
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
        // Row 2 - Purples & Pinks
        '#c026d3', '#e879f9', '#ec4899', '#f472b6', '#fb7185',
        // Row 3 - Reds & Oranges
        '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#f97316', '#fb923c', '#fbbf24', '#facc15',
        // Row 4 - Whites & Grays & Blacks  
        '#ffffff', '#e5e7eb', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#000000'
    ];

    const loadEtiquetas = async () => {
        setLoading(true);
        try {
            const response = await tagsServices.getAllEtiquetas();
            if (response.success && response.data) {
                setEtiquetas(response.data);
            } else {
                toast({
                    title: "Error",
                    description: "No se pudieron cargar las etiquetas",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error al cargar etiquetas:', error);
            toast({
                title: "Error",
                description: "Error inesperado al cargar etiquetas",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEtiquetas();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nombre.trim()) {
            toast({
                title: "Error",
                description: "El nombre de la etiqueta es obligatorio",
                variant: "destructive",
            });
            return;
        }

        try {
            if (editingEtiqueta) {
                const response = await tagsServices.updateEtiqueta(editingEtiqueta.id, formData);
                if (response.success) {
                    toast({
                        title: "Éxito",
                        description: "Etiqueta actualizada correctamente",
                    });
                    await loadEtiquetas();
                    cerrarModal();
                } else {
                    toast({
                        title: "Error al actualizar",
                        description: response.error || "No se pudo actualizar la etiqueta",
                        variant: "destructive",
                    });
                }
            } else {
                const response = await tagsServices.createEtiqueta(formData);
                if (response.success) {
                    toast({
                        title: "Éxito",
                        description: "Etiqueta creada correctamente",
                    });
                    await loadEtiquetas();
                    cerrarModal();
                } else {
                    toast({
                        title: "Error al crear",
                        description: response.error || "No se pudo crear la etiqueta. Verifica los permisos.",
                        variant: "destructive",
                    });
                }
            }
        } catch (error: any) {
            console.error('Error al guardar etiqueta:', error);
            toast({
                title: "Error",
                description: error?.message || "No se pudo guardar la etiqueta. Intenta nuevamente.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = (etiqueta: EtiquetaResponse) => {
        setEtiquetaToDelete(etiqueta);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!etiquetaToDelete) return;

        try {
            const response = await tagsServices.deleteEtiqueta(etiquetaToDelete.id);
            if (response.success) {
                toast({
                    title: "Éxito",
                    description: "Etiqueta eliminada correctamente",
                });
                setShowDeleteModal(false);
                setEtiquetaToDelete(null);
                loadEtiquetas();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error al eliminar etiqueta:', error);
            toast({
                title: "Error",
                description: "No se pudo eliminar la etiqueta",
                variant: "destructive",
            });
        }
    };

    const abrirModal = (etiqueta?: EtiquetaResponse) => {
        if (etiqueta) {
            setEditingEtiqueta(etiqueta);
            setFormData({
                nombre: etiqueta.nombre,
                color: etiqueta.color,
                descripcion: etiqueta.descripcion || ''
            });
        } else {
            setEditingEtiqueta(null);
            setFormData({
                nombre: '',
                color: '#10b981',
                descripcion: ''
            });
        }
        setShowModal(true);
    };

    const cerrarModal = () => {
        setShowModal(false);
        setEditingEtiqueta(null);
        setFormData({
            nombre: '',
            color: '#10b981',
            descripcion: ''
        });
    };

    const etiquetasFiltradas = etiquetas;

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Tag className="h-6 w-6 text-foreground" />
                <h2 className="text-2xl font-bold text-foreground">Etiquetas</h2>
                <Badge variant="secondary" className="ml-2">
                    {etiquetas.length}
                </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
                Crear, editar y eliminar tus etiquetas
            </p>

            {/* Content Area */}
            <div className="bg-[#2a3942] rounded-lg p-6 min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {etiquetasFiltradas.map((etiqueta) => (
                            <div
                                key={etiqueta.id}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 bg-transparent hover:bg-white/5 transition-colors group"
                                style={{ borderColor: etiqueta.color }}
                            >
                                <span className="text-sm font-medium uppercase text-foreground">
                                    {etiqueta.nombre}
                                </span>
                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => abrirModal(etiqueta)}
                                        className="p-1 hover:bg-white/10 rounded transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="h-3 w-3 text-foreground" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(etiqueta)}
                                        className="p-1 hover:bg-white/10 rounded transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-3 w-3 text-foreground" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        
                        {/* Add Button */}
                        <button
                            onClick={() => abrirModal()}
                            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            title="Nueva etiqueta"
                        >
                            <Plus className="h-6 w-6 text-foreground" />
                        </button>
                    </div>
                )}

                {!loading && etiquetasFiltradas.length === 0 && (
                    <div className="text-center py-12">
                        <Tag className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                        <h3 className="mt-4 text-lg font-semibold text-foreground">No hay etiquetas</h3>
                        <p className="text-muted-foreground text-sm mt-2">
                            Haz clic en el botón + para crear tu primera etiqueta
                        </p>
                    </div>
                )}
            </div>

            {/* Modal Crear/Editar */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="bg-[#2a3942] border-[#374151] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-lg">
                            {editingEtiqueta ? 'Editar etiqueta' : 'Crear etiqueta'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Input
                                id="nombre"
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Nombre"
                                required
                                className="bg-[#1f2937] border-[#374151] text-foreground placeholder:text-muted-foreground"
                            />
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Color</p>
                            <div className="grid grid-cols-9 gap-2">
                                {coloresPredefinidos.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, color })}
                                        className={`w-10 h-10 rounded-full transition-all ${
                                            formData.color === color 
                                                ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a3942] scale-110' 
                                                : 'hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {editingEtiqueta ? 'Actualizar Etiqueta' : 'Crear Etiqueta'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Eliminar */}
            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la etiqueta "{etiquetaToDelete?.nombre}".
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setEtiquetaToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
