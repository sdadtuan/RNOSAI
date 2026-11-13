import Link from 'next/link';
import { PortalPublicShell } from '@/components/layout';

export default function NotFound() {
  return (
    <PortalPublicShell
      narrow
      title="Không tìm thấy trang"
      subtitle="Đường dẫn không tồn tại hoặc đã được chuyển đi."
      footer={
        <p style={{ margin: 0 }}>
          <Link href="/login">Về trang đăng nhập</Link>
        </p>
      }
    >
      <p>
        Trang bạn đang tìm không có trên cổng khách hàng PTT. Kiểm tra lại đường dẫn
        hoặc quay về trang chính.
      </p>
      <p>
        <Link href="/dashboard" className="btn">
          Về trang tổng quan
        </Link>
      </p>
    </PortalPublicShell>
  );
}
