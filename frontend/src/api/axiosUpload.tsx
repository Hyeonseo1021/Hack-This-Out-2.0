import axiosInstance from './axiosInit';

/**
 * 아이템 이미지 업로드
 */
export const uploadItemImage = async (file: File): Promise<{ imageUrl: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await axiosInstance.post('/shop/upload-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return {
    imageUrl: res.data?.imageUrl ?? '',
  };
};
