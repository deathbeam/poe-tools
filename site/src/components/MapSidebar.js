import MapName from './MapName'
import Rating from './Rating'
import MapConnected from './MapConnected'
import MapCards from './MapCards'

const MapSidebar = ({ map, currentSearch, addToInput, cardValueSourceInput, voidstones, setCurrentMap }) => (
  <>
    <Rating rating={map.score} scale={10} label="Total" />
    <Rating rating={map.rating.layout} label="Layout" tooltip={map.info.layout} sidebar={true} />
    <Rating rating={map.rating.density} label="Density" tooltip={map.info.density} sidebar={true} />
    <Rating rating={map.rating.boss} label="Boss" tooltip={map.info.boss} sidebar={true} />
    <hr />
    <MapName map={map} sidebar={true} currentSearch={currentSearch} addToInput={addToInput} voidstones={voidstones} />
    <hr />
    <MapConnected connected={map.connected} onClick={setCurrentMap} />
    <hr />
    <MapCards sidebar={true} cardValueSourceInput={cardValueSourceInput} unique={map.unique} cards={map.cards} />
  </>
)

export default MapSidebar
