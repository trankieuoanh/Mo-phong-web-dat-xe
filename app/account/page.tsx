'use client';

/**
 * /account — Tai khoan phu. Theo sample_ui/tai_khoan_phu.png.
 *
 * KHONG NAM TRONG FUNNEL: khong co trong `SCREENS`, khong goi `useScreenView`,
 * khong goi `trackEvent` — giong /history (CLAUDE.md quy tac 9). Man nay khong
 * phai mot buoc dat xe hay dat do an, nen mot event tu day chi lam sai mau so
 * cua moi ti le conversion.
 *
 * Trang thai RONG la trang thai duy nhat: du an khong co authentication
 * (quy tac 11), nen khong bao gio co tai khoan phu that de liet ke. Anh mau
 * cung chup dung trang thai nay.
 */

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useToast } from '@/components/Toast';
import { AppShell } from '@/components/shell/AppShell';

export default function AccountPage() {
  const toast = useToast();

  return (
    <AppShell section="Tài khoản phụ">
      {/* `flex-1 justify-center` de khoi rong canh giua theo CHIEU DOC nhu anh
          mau, thay vi dinh len sat top bar. `main` cua AppShell da la flex-col
          co chieu cao, nen chi can nhan phan con lai. */}
      <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-[1280px] flex-1 flex-col justify-center">
        <EmptyState
          className="w-full min-w-0 break-words"
          icon="users"
          title="Chưa có tài khoản phụ nào"
          description="Thêm thành viên mới làm tài khoản phụ của bạn để bắt đầu"
          action={
            <PrimaryButton
              fullWidth={false}
              // Noi that thay vi im lang. Khong co backend cho viec nay, nhung
              // mot nut bam vao khong phan hoi gi thi nguoi dung khong phan biet
              // duoc "chua lam" voi "vua bam hong".
              onClick={() => toast.show('Tính năng này ngoài phạm vi mô phỏng')}
            >
              Thêm thành viên mới
            </PrimaryButton>
          }
        />
      </div>
    </AppShell>
  );
}
