import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface ProductCardInChatProps {
    product: {
        id: string;
        name: string;
        description?: string;
        price: number;
        image_url?: string;
    };
    onAddToCart?: (productId: string) => void;
}

export function ProductCardInChat({ product, onAddToCart }: ProductCardInChatProps) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden 
                    shadow-sm hover:shadow-md transition max-w-[240px] mt-2 ml-10">
            {/* Image */}
            <div className="w-full h-24 bg-gray-50 overflow-hidden">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                        No image
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-2.5">
                <h4 className="font-medium text-gray-900 text-xs truncate">{product.name}</h4>

                <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-violet-600 text-xs">
                        {product.price.toLocaleString()}₮
                    </span>

                    {onAddToCart && (
                        <button
                            onClick={() => onAddToCart(product.id)}
                            className="flex items-center gap-1 px-2 py-1 
                                     bg-violet-600 text-white text-[10px] font-medium 
                                     rounded-lg hover:bg-violet-700 transition"
                        >
                            <ShoppingCart className="w-3 h-3" />
                            Сагслах
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
