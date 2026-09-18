'use client';

/**
 * O xam nhap nho trong luc cho du lieu. Rut ra tu PlacePicker.tsx, noi thu phap
 * nay da duoc dung dung: `h-[76px] animate-pulse rounded-md bg-canvas-soft`.
 *
 * Vi sao can mot component rieng: dai "Gan ban" o man menu truoc day AN HAN
 * trong luc tai, nen man hinh lang le thay doi chieu cao khi du lieu ve — va
 * quan trong hon, "dang tai" va "loi" va "khong co quan nao" trong giong het
 * nhau, tuc khong the phan biet bang mat.
 */

interface SkeletonProps {
  /** Class chieu cao/be ngang, vi du "h-[76px] w-full". */
  className?: string;
  /** So o lap lai. Mac dinh 1. */
  count?: number;
}

export function Skeleton({ className = 'h-[76px] w-full', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`block animate-pulse rounded-md bg-canvas-soft ${className}`}
        />
      ))}
    </>
  );
}
