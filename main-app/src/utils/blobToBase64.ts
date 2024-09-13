export const blobToBase64 = (blob: Blob, callback: (base64data: string) => void): void => {
    const reader = new FileReader();
  
    reader.onloadend = function () {
      const base64data = (reader.result as string).split(",")[1];
      callback(base64data);
    };
  
    reader.readAsDataURL(blob);
  };