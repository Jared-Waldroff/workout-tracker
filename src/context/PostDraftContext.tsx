import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as ImagePicker from 'expo-image-picker';

interface PostDraftContextData {
    caption: string;
    setCaption: (caption: string) => void;
    selectedPhotos: ImagePicker.ImagePickerAsset[];
    setSelectedPhotos: (photos: ImagePicker.ImagePickerAsset[]) => void;
    selectedWorkout: any | null;
    setSelectedWorkout: (workout: any | null) => void;
    clearDraft: () => void;
}

const PostDraftContext = createContext<PostDraftContextData | undefined>(undefined);

export const PostDraftProvider = ({ children }: { children: ReactNode }) => {
    const [caption, setCaption] = useState('');
    const [selectedPhotos, setSelectedPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
    const [selectedWorkout, setSelectedWorkout] = useState<any | null>(null);

    const clearDraft = () => {
        setCaption('');
        setSelectedPhotos([]);
        setSelectedWorkout(null);
    };

    return (
        <PostDraftContext.Provider
            value={{
                caption,
                setCaption,
                selectedPhotos,
                setSelectedPhotos,
                selectedWorkout,
                setSelectedWorkout,
                clearDraft,
            }}
        >
            {children}
        </PostDraftContext.Provider>
    );
};

export const usePostDraft = () => {
    const context = useContext(PostDraftContext);
    if (!context) {
        throw new Error('usePostDraft must be used within a PostDraftProvider');
    }
    return context;
};
