import { FeatureGrid } from './components/FeatureGrid';
import './styles/tokens.css';

const FEATURES = [
  { id: 'berths', title: 'Berth board', body: 'Live occupancy for every pontoon.' },
  { id: 'tides', title: 'Tide windows', body: 'Launch windows computed from the local tide table.' },
  { id: 'crew', title: 'Crew rota', body: 'Who is on the water, and when they are back.' },
  { id: 'logs', title: 'Maintenance log', body: 'Every job, part and invoice per vessel.' },
];

export default function App() {
  return <main><FeatureGrid features={FEATURES} /></main>;
}
