import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/ui';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Identify from './pages/Identify';
import WineDetail from './pages/WineDetail';
import Analytics from './pages/Analytics';
import Grapes from './pages/Grapes';
import GrapeDetail from './pages/GrapeDetail';
import Atlas from './pages/Atlas';
import CountryDetail from './pages/CountryDetail';
import RegionDetail from './pages/RegionDetail';
import Pairings from './pages/Pairings';
import PairingDetail from './pages/PairingDetail';
import TasteTest from './pages/TasteTest';
import BlindTasting from './pages/BlindTasting';
import Cellar from './pages/Cellar';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/identify" element={<Identify />} />
        <Route path="/wine/:id" element={<WineDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/grapes" element={<Grapes />} />
        <Route path="/grapes/:name" element={<GrapeDetail />} />
        <Route path="/atlas" element={<Atlas />} />
        <Route path="/atlas/:code" element={<CountryDetail />} />
        <Route path="/region/:id" element={<RegionDetail />} />
        <Route path="/pairings" element={<Pairings />} />
        <Route path="/pairings/:name" element={<PairingDetail />} />
        <Route path="/taste" element={<TasteTest />} />
        <Route path="/blind" element={<BlindTasting />} />
        <Route path="/cellar" element={<Cellar />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
