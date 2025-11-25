import { EventsTable } from '../../components/events-table.island';
import { Island } from '../../lib/island';

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
