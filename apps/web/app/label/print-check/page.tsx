import { notFound } from 'next/navigation';
import PrintCheck from './PrintCheck';

// Development aid: the real printed label for sample prescriptions, with the print guard's verdict
// (docs/PRINT_LAYOUT_AND_STAT_OPTIONS.md). Never served by a production build.
export default function PrintCheckPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PrintCheck />;
}
