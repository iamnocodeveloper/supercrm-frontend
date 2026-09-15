import React from 'react';
import { EmbudoResponse } from '@/services/embudoServices';

interface EmbudosFilterProps {
    embudos: EmbudoResponse[];
    selectedEmbudo: EmbudoResponse | null;
    onEmbudoSelect: (embudo: EmbudoResponse | null) => void;
}

export default function EmbudosFilter({
    embudos,
    selectedEmbudo,
    onEmbudoSelect
}: EmbudosFilterProps) {

    return (
        <div className="bg-card border-b border-border">
            <div className="px-3 py-2 md:px-4 md:py-3">
                <div
                    className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-2 scrollbar-hide"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                >
                    {/* Opción "Todos" */}
                    <button
                        onClick={() => onEmbudoSelect(null)}
                        className={`flex-shrink-0 px-4 py-1.5 md:px-5 md:py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[36px] md:min-h-0 ${
                            selectedEmbudo === null
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                        Todos
                    </button>

                    {/* Lista de embudos */}
                    {embudos.map((embudo) => {
                        const isSelected = selectedEmbudo?.id === embudo.id;

                        return (
                            <button
                                key={embudo.id}
                                onClick={() => onEmbudoSelect(embudo)}
                                className={`flex-shrink-0 px-4 py-1.5 md:px-5 md:py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[36px] md:min-h-0 ${
                                    isSelected
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                                title={embudo.name}
                            >
                                {embudo.name}
                            </button>
                        );
                    })}

                    {/* Mensaje cuando no hay embudos */}
                    {embudos.length === 0 && (
                        <div className="text-muted-foreground text-sm py-2">
                            No hay embudos configurados
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
