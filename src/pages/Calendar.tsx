import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X } from 'lucide-react';
import { taskServices, TareaResponse } from '../services/taskServices';
import { supabase } from '@/integrations/supabase/client';

// Tipos para las tareas
interface Task extends TareaResponse {
    completada?: boolean;
    color?: string;
    asignado_nombre?: string;
}

interface Usuario {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_type: string | null;
}

const categorias = [
    { id: 'Trabajo', label: 'Trabajo', color: '#4ecdc4' },
    { id: 'Personal', label: 'Personal', color: '#45b7d1' },
    { id: 'Reunion', label: 'Reunión', color: '#ff6b6b' },
    { id: 'Llamada', label: 'Llamada', color: '#96ceb4' },
    { id: 'Otro', label: 'Otro', color: '#a8e6cf' }
];

const prioridades = [
    { id: 'Alta', label: 'Alta', color: '#ff6b6b' },
    { id: 'Media', label: 'Media', color: '#feca57' },
    { id: 'Baja', label: 'Baja', color: '#96ceb4' }
];

export default function Calendar() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const navigate = useNavigate();

    // Form state para nueva tarea
    const [formData, setFormData] = useState({
        titulo: '',
        descripion: '',
        fecha: '',
        hora: '09:00',
        categoria: 'Trabajo',
        prioridad: 'Media',
        asignada: 0
    });

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }

        // Get user details from profiles table
        const { data: userData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        setCurrentUser(userData);
        loadUsuarios();
        loadTareas(userData);
    };

    // Cargar usuarios para el select
    const loadUsuarios = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, first_name, last_name, profile_type')
                .order('email');

            if (error) {
                console.error('Error al cargar usuarios:', error);
                return;
            }

            setUsuarios(data || []);
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
        }
    };

    // Cargar tareas desde Supabase
    const loadTareas = async (user: any) => {
        setLoading(true);
        try {
            let result;

            // Filtrar tareas según el tipo de perfil del usuario
            if (user?.profile_type === 'client') {
                // Los usuarios client solo ven tareas asignadas a ellos
                result = await taskServices.getTareasByUser(user.id);
            } else {
                // Los usuarios admin/superadmin ven todas las tareas
                result = await taskServices.getAllTareas();
            }

            if (result.success && result.data) {
                // Enriquecer tareas con información de usuarios y colores
                const enrichedTasks = result.data.map((task: TareaResponse) => {
                    const categoria = categorias.find(c => c.id === task.categoria);
                    const usuario = usuarios.find(u => u.id === task.asignada?.toString());

                    return {
                        ...task,
                        hora: task.hora || '09:00',
                        color: categoria?.color || '#4ecdc4',
                        completada: false,
                        asignado_nombre: usuario ? `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() || usuario.email : undefined
                    };
                });

                setTasks(enrichedTasks);
            } else {
                console.error('Error al cargar tareas:', result.error);
            }
        } catch (error) {
            console.error('Error al cargar tareas:', error);
        } finally {
            setLoading(false);
        }
    };

    // Obtener días del mes actual
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        for (let i = 0; i < 42; i++) {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            days.push(day);
        }
        return days;
    };

    // Obtener días de la semana actual
    const getDaysInWeek = (date: Date) => {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            days.push(day);
        }

        return days;
    };

    // Obtener tareas para una fecha específica
    const getTasksForDate = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return tasks.filter(task => task.fecha === dateStr);
    };

    // Manejar navegación según la vista actual
    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);

        if (viewMode === 'month') {
            newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (viewMode === 'week') {
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        } else if (viewMode === 'day') {
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        }

        setCurrentDate(newDate);
    };

    // Seleccionar día para mostrar tareas
    const selectDay = (date: string) => {
        setSelectedDate(date);
    };

    // Abrir modal para nueva tarea
    const openNewTaskModal = (date?: string) => {
        setEditingTask(null);
        setFormData({
            titulo: '',
            descripion: '',
            fecha: date || selectedDate || '',
            hora: '09:00',
            categoria: 'Trabajo',
            prioridad: 'Media',
            asignada: 0
        });
        setShowTaskModal(true);
    };

    // Abrir modal para editar tarea
    const openEditTaskModal = (task: Task) => {
        setEditingTask(task);
        setFormData({
            titulo: task.titulo,
            descripion: task.descripion || '',
            fecha: task.fecha,
            hora: task.hora || '09:00',
            categoria: task.categoria,
            prioridad: task.prioridad,
            asignada: task.asignada || 0
        });
        setShowTaskModal(true);
    };

    // Guardar tarea
    const handleSaveTask = async () => {
        if (!formData.titulo || !formData.fecha) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }

        setLoading(true);

        try {
            const tareaData = {
                titulo: formData.titulo,
                descripion: formData.descripion,
                fecha: formData.fecha,
                hora: formData.hora,
                categoria: formData.categoria,
                prioridad: formData.prioridad,
                asignada: formData.asignada || undefined,
                creado_por: currentUser?.id
            };

            if (editingTask) {
                // Actualizar tarea existente
                const result = await taskServices.updateTarea(editingTask.id, tareaData);
                if (result.success) {
                    await loadTareas(currentUser);
                    setShowTaskModal(false);
                } else {
                    alert('Error al actualizar la tarea: ' + result.error);
                }
            } else {
                // Crear nueva tarea
                const result = await taskServices.createTarea(tareaData);
                if (result.success) {
                    await loadTareas(currentUser);
                    setShowTaskModal(false);
                } else {
                    alert('Error al crear la tarea: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error al guardar tarea:', error);
            alert('Error inesperado al guardar la tarea');
        } finally {
            setLoading(false);
        }
    };

    // Abrir modal de confirmación para eliminar tarea
    const openDeleteModal = (task: Task) => {
        setTaskToDelete(task);
        setShowDeleteModal(true);
    };

    // Eliminar tarea confirmada
    const confirmDeleteTask = async () => {
        if (!taskToDelete) return;

        setLoading(true);
        try {
            const result = await taskServices.deleteTarea(taskToDelete.id);
            if (result.success) {
                await loadTareas(currentUser);
                setShowDeleteModal(false);
                setTaskToDelete(null);
            } else {
                alert('Error al eliminar la tarea: ' + result.error);
            }
        } catch (error) {
            console.error('Error al eliminar tarea:', error);
            alert('Error inesperado al eliminar la tarea');
        } finally {
            setLoading(false);
        }
    };

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const days = getDaysInMonth(currentDate);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    return (
        <div className="flex-1 flex flex-col">
            {/* Header del Calendario */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-gray-900 dark:text-white font-semibold text-2xl">Calendario</h1>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Botones de vista */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            {(['month', 'week', 'day'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === mode
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                >
                                    {mode === 'month' ? 'Mes' : mode === 'week' ? 'Semana' : 'Día'}
                                </button>
                            ))}
                        </div>

                        {currentUser?.profile_type !== 'client' && (
                            <button
                                onClick={() => openNewTaskModal(selectedDate)}
                                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nueva Tarea</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Navegación del calendario */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigateDate('prev')}
                            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <h2 className="text-gray-900 dark:text-white font-semibold text-xl">
                            {viewMode === 'month'
                                ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                                : viewMode === 'week'
                                    ? (() => {
                                        const startOfWeek = new Date(currentDate);
                                        const day = startOfWeek.getDay();
                                        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                                        startOfWeek.setDate(diff);

                                        const endOfWeek = new Date(startOfWeek);
                                        endOfWeek.setDate(startOfWeek.getDate() + 6);

                                        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                                            return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} de ${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
                                        } else {
                                            return `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
                                        }
                                    })()
                                    : currentDate.toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                            }
                        </h2>

                        <button
                            onClick={() => navigateDate('next')}
                            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-3 py-1 rounded border border-gray-200 dark:border-gray-600 hover:border-gray-400"
                    >
                        Hoy
                    </button>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-6 overflow-auto">
                {/* Vista de mes */}
                {viewMode === 'month' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {/* Header de días */}
                        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                            {dayNames.map((day) => (
                                <div key={day} className="p-4 text-center text-gray-600 dark:text-gray-400 font-medium text-sm">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Grid de días */}
                        <div className="grid grid-cols-7">
                            {days.map((day, index) => {
                                const dayStr = day.toISOString().split('T')[0];
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                const isToday = dayStr === todayStr;
                                const dayTasks = getTasksForDate(day);

                                return (
                                    <div
                                        key={index}
                                        className={`min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-2 ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            } ${selectedDate === dayStr ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''
                                            } transition-colors cursor-pointer`}
                                        onClick={() => selectDay(dayStr)}
                                    >
                                        <div className={`text-sm font-medium mb-2 ${isToday
                                            ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                                            : isCurrentMonth
                                                ? 'text-gray-900 dark:text-white'
                                                : 'text-gray-400 dark:text-gray-600'
                                            }`}>
                                            {day.getDate()}
                                        </div>

                                        {/* Tareas del día */}
                                        <div className="space-y-1">
                                            {dayTasks.slice(0, 3).map((task) => (
                                                <div
                                                    key={task.id}
                                                    className={`text-xs p-1 rounded truncate cursor-pointer transition-opacity ${task.completada ? 'opacity-50 line-through' : ''
                                                        }`}
                                                    style={{
                                                        backgroundColor: task.color + '20',
                                                        color: task.color
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditTaskModal(task);
                                                    }}
                                                    title={`${task.hora} - ${task.titulo}`}
                                                >
                                                    {task.hora} {task.titulo}
                                                </div>
                                            ))}
                                            {dayTasks.length > 3 && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                                    +{dayTasks.length - 3} más
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Vista de semana */}
                {viewMode === 'week' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {/* Header de días */}
                        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                            {dayNames.map((day) => (
                                <div key={day} className="p-4 text-center text-gray-600 dark:text-gray-400 font-medium text-sm">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Grid de días de la semana */}
                        <div className="grid grid-cols-7">
                            {getDaysInWeek(currentDate).map((day, index) => {
                                const dayStr = day.toISOString().split('T')[0];
                                const isToday = dayStr === todayStr;
                                const dayTasks = getTasksForDate(day);

                                return (
                                    <div
                                        key={index}
                                        className={`min-h-[200px] border-r border-b border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedDate === dayStr ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : ''
                                            } transition-colors cursor-pointer`}
                                        onClick={() => selectDay(dayStr)}
                                    >
                                        <div className={`text-sm font-medium mb-3 ${isToday
                                            ? 'bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center'
                                            : 'text-gray-900 dark:text-white'
                                            }`}>
                                            {day.getDate()}
                                        </div>

                                        {/* Tareas del día */}
                                        <div className="space-y-2">
                                            {dayTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className={`text-xs p-2 rounded cursor-pointer transition-opacity ${task.completada ? 'opacity-50 line-through' : ''
                                                        }`}
                                                    style={{
                                                        backgroundColor: task.color + '20',
                                                        color: task.color
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditTaskModal(task);
                                                    }}
                                                    title={task.titulo}
                                                >
                                                    <div className="font-medium">{task.hora}</div>
                                                    <div>{task.titulo}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Vista de día */}
                {viewMode === 'day' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${new Date().toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]
                                    ? 'bg-blue-600'
                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                                    }`}>
                                    {currentDate.getDate()}
                                </div>
                                <div>
                                    <h3 className="text-gray-900 dark:text-white font-semibold text-lg">
                                        {currentDate.toLocaleDateString('es-ES', { weekday: 'long' })}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        {currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tareas del día */}
                        <div className="space-y-3">
                            {getTasksForDate(currentDate).map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    style={{ borderLeftWidth: '4px', borderLeftColor: task.color }}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{task.hora}</span>
                                            <h4 className="font-medium text-gray-900 dark:text-white">{task.titulo}</h4>
                                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: task.color + '20', color: task.color }}>
                                                {task.categoria}
                                            </span>
                                        </div>
                                        {task.descripion && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{task.descripion}</p>
                                        )}
                                        {task.asignado_nombre && (
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Asignado a: {task.asignado_nombre}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => openEditTaskModal(task)}
                                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        {currentUser?.rol !== 'Comercial' && (
                                            <button
                                                onClick={() => openDeleteModal(task)}
                                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {getTasksForDate(currentDate).length === 0 && (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    No hay tareas para este día
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Tarea */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
                            </h3>
                            <button
                                onClick={() => setShowTaskModal(false)}
                                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Título *
                                </label>
                                <input
                                    type="text"
                                    value={formData.titulo}
                                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Título de la tarea"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripción
                                </label>
                                <textarea
                                    value={formData.descripion}
                                    onChange={(e) => setFormData({ ...formData, descripion: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Descripción de la tarea"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.fecha}
                                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Hora
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.hora}
                                        onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Categoría
                                </label>
                                <select
                                    value={formData.categoria}
                                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    {categorias.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Prioridad
                                </label>
                                <select
                                    value={formData.prioridad}
                                    onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    {prioridades.map((pri) => (
                                        <option key={pri.id} value={pri.id}>{pri.label}</option>
                                    ))}
                                </select>
                            </div>

                            {currentUser?.rol !== 'Comercial' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Asignar a
                                    </label>
                                    <select
                                        value={formData.asignada}
                                        onChange={(e) => setFormData({ ...formData, asignada: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value={0}>Sin asignar</option>
                                        {usuarios.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.first_name && user.last_name 
                                                    ? `${user.first_name} ${user.last_name}` 
                                                    : user.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowTaskModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveTask}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Confirmar Eliminación
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            ¿Estás seguro de que deseas eliminar la tarea "{taskToDelete?.titulo}"?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteTask}
                                disabled={loading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                            >
                                {loading ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
