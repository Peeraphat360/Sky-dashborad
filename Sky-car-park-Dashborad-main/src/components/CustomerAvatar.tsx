import React, { useState } from 'react';

interface CustomerAvatarProps {
  name: string;
  pictureUrl?: string;
  isReturning?: boolean;
  /** ขนาด + รูปทรง เช่น "w-9 h-9 rounded-full" */
  className?: string;
}

// แสดงรูปโปรไฟล์ LINE ถ้ามี — ถ้าไม่มี/โหลดไม่ขึ้น fallback เป็นวงกลมไล่สี + ตัวอักษรแรกของชื่อ
export const CustomerAvatar: React.FC<CustomerAvatarProps> = ({
  name, pictureUrl, isReturning, className = 'w-9 h-9 rounded-full',
}) => {
  const [errored, setErrored] = useState(false);
  const showImg = !!pictureUrl && !errored;

  if (showImg) {
    return (
      <img
        src={pictureUrl}
        alt={name}
        loading="lazy"
        onError={() => setErrored(true)}
        className={`${className} object-cover flex-shrink-0 ring-2 ring-white shadow-sm bg-slate-100`}
      />
    );
  }

  const bg = isReturning
    ? 'bg-gradient-to-br from-purple-500 to-purple-700'
    : 'bg-gradient-to-br from-emerald-500 to-emerald-700';

  return (
    <div className={`${className} ${bg} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {name.charAt(0)}
    </div>
  );
};
