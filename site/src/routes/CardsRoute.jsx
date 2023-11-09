import GoToTop from '../components/GoToTop'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import MapFilter from '../components/MapFilter'
import Card from '../components/cards/Card'
import { useAtomValue } from 'jotai'
import state from '../state'
import { useDeferredValue } from 'react'

const CardsRoute = () => {
  const filteredCards = useAtomValue(state.filteredCards)

  return (
    <>
      <GoToTop />
      <Navbar />
      <div className="container-fluid p-2 row g-0">
        <MapFilter sidebar={false} />
      </div>
      <table className="table table-responsive mb-0">
        <thead>
          <tr>
            <th>Card</th>
            <th>Sources</th>
          </tr>
        </thead>
        <tbody>
          {useDeferredValue(filteredCards).map(c => (
            <Card key={c.name} card={c} />
          ))}
        </tbody>
      </table>
      <Footer />
    </>
  )
}

export default CardsRoute
