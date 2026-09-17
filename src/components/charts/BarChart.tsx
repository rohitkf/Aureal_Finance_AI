import { cn } from '@/lib/cn';
import { money, moneyAxis } from '@/lib/format';

export interface BarSeries {
  label: string;
  income: number;
  expenses: number;
}

/** Income vs expenses per month. Paired bars, not stacked — they're compared. */
export const IncomeExpenseChart = ({ data, className }: { data: BarSeries[]; className?: string }) => {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  const height = 220;
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <figure className={cn('w-full', className)}>
      <div className="flex gap-3">
        <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right">
          {[...gridValues].reverse().map((v) => (
            <span key={v} className="tnum text-label-sm text-faint">
              {moneyAxis(v)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div className="absolute inset-0 flex flex-col justify-between">
            {gridValues.map((v) => (
              <div key={v} className="border-t border-dashed border-[rgb(var(--hairline)/0.1)]" />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-2">
            {data.map((d) => (
              <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-1">
                  <div
                    className="w-full max-w-[18px] rounded-t bg-success transition-[height] duration-500"
                    style={{ height: `${(d.income / max) * 100}%` }}
                    title={`${d.label} income ${money(d.income)}`}
                  />
                  <div
                    className="w-full max-w-[18px] rounded-t bg-danger/80 transition-[height] duration-500"
                    style={{ height: `${(d.expenses / max) * 100}%` }}
                    title={`${d.label} expenses ${money(d.expenses)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 pl-[60px]">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 text-center text-label-sm text-faint">
            {d.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 pl-[60px]">
        <span className="flex items-center gap-1.5 text-label-sm text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Income
        </span>
        <span className="flex items-center gap-1.5 text-label-sm text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger/80" /> Expenses
        </span>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Income versus expenses by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{money(d.income)}</td>
                <td>{money(d.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
};
