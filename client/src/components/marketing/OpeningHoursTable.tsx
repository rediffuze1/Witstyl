import { salonConfig } from '@/config/salon-config';

export default function OpeningHoursTable() {
  const formatHours = (open?: string, close?: string, closed?: boolean) => {
    if (closed || !open || !close) return 'Fermé';
    return `${open} – ${close}`;
  };

  return (
    <div className="glass-card p-6 backdrop-blur-xl">
      <table className="w-full text-sm">
        <tbody>
          {salonConfig.openingHours.map((hour) => (
            <tr key={hour.day} className="border-b border-slate-200 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-900">{hour.day}</td>
              <td className="px-4 py-3 text-slate-600 text-right">
                {formatHours(hour.open, hour.close, hour.closed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

