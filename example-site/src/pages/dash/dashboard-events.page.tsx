import { EventsTable } from '../../components/events-table.island';
import { Island } from '../../lib/island';
import type { PageConfig } from '../../scripts/build';

export const page: PageConfig = {
  path: '/dashboard/events',
};

export default function DashboardEvents() {
  return (
    <div>
      <div>dashboard events</div>
      <Island id="events-table">
        <EventsTable />
      </Island>
    </div>
  );
}
