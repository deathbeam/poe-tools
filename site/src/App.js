import 'bootstrap/dist/css/bootstrap.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './App.css'

import { useCallback, useMemo, useRef, useTransition } from 'react'
import { defaultCardBaseline, issueTemplate, preparedCards, preparedGlobals, preparedMaps } from './data'
import Loader from './components/Loader'
import { calculateScore, filter, mapTierToLevel } from './common'
import usePersistedState from './hooks/usePersistedState'
import useInputField from './hooks/useInputField'
import ListView from './views/ListView'
import AtlasView from './views/AtlasView'

function rateMaps(
  foundMaps,
  foundCards,
  layoutInput,
  densityInput,
  bossInput,
  cardInput,
  cardBaselineInput,
  cardBaselineNumberInput,
  cardMinPriceInput,
  cardPriceSourceInput,
  cardValueSourceInput,
  cardDisplayInput,
  voidstones
) {
  let cardWeightBaseline = preparedCards.find(c => c.name === cardBaselineInput).weight
  if (cardBaselineNumberInput > 0) {
    cardWeightBaseline /= cardBaselineNumberInput
  } else if (cardBaselineNumberInput < 0) {
    cardWeightBaseline *= Math.abs(cardBaselineNumberInput)
  }

  // First calculate value for cards
  const mapsWithCardValues = foundMaps.map(map => {
    const mapLevel = mapTierToLevel(map.tiers[voidstones])
    const mapCards = []
    let mapWeight = 0
    let bossWeight = 0

    for (let card of map.cards) {
      const cardMinLevel = (card.drop || {}).min_level || 0
      const cardMaxLevel = (card.drop || {}).max_level || 99
      const dropEligible = mapLevel >= cardMinLevel && mapLevel <= cardMaxLevel
      const weight = dropEligible ? card.weight || 0 : 0
      const price = (cardPriceSourceInput === 'standard' ? card.standardPrice : card.price) || 0

      bossWeight += weight
      if (!card.boss) {
        mapWeight += weight
      }

      mapCards.push({
        ...card,
        price,
        weight,
        unknown: !card.weight
      })
    }

    for (let card of mapCards) {
      card.mapWeight = preparedGlobals.droppool_weight + (card.boss ? bossWeight : mapWeight)
      card.kiracWeight = bossWeight
      card.dropPoolItems = 1 / (cardWeightBaseline / card.mapWeight) / (card.boss ? 10 : 1)

      const dropEligible = card.weight > 0
      const priceEligible = card.price >= cardMinPriceInput
      if (!card.unknown) {
        if (
          (cardDisplayInput === 'high+drop' && (!dropEligible || !priceEligible)) ||
          (cardDisplayInput === 'high' && !priceEligible) ||
          (cardDisplayInput === 'drop' && !dropEligible)
        ) {
          card.hidden = true
          card.value = 0
          continue
        }
      }

      if (!priceEligible) {
        card.value = 0
        continue
      }

      if (cardValueSourceInput === 'kirac') {
        card.value = map.unique ? 0 : card.stack * card.price * (card.weight / card.kiracWeight)
      } else {
        card.value = card.price * (card.weight / card.mapWeight) * card.dropPoolItems
      }
    }

    return {
      ...map,
      cards: mapCards.sort((a, b) => b.price - a.price).sort((a, b) => b.value - a.value)
    }
  })

  // Now calculate score for each card
  calculateScore(
    mapsWithCardValues.flatMap(m => m.cards),
    10
  )

  // Now finally calculate overall map score
  const rated = calculateScore(
    mapsWithCardValues.map(map => {
      const layoutValue = (map.rating.layout || 0) * layoutInput
      const densityValue = (map.rating.density || 0) * densityInput
      const bossValue = (map.rating.boss || 0) * bossInput
      let cardValue = 0

      for (let card of map.cards) {
        cardValue += card.score * cardInput
      }

      map.value = layoutValue + densityValue + bossValue + cardValue
      return map
    }),
    100
  )

  // Now find scores for connected maps
  for (let map of rated) {
    const connectedOut = []
    for (let connected of map.connected || []) {
      connectedOut.push({
        name: connected,
        score: (rated.find(rm => rm.name === connected) || {}).score || 0
      })
    }
    map.connected = connectedOut
  }

  return rated.sort((a, b) => b.score - a.score)
}

function parseSearch(s) {
  return (s || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e)
    .map(e => ({
      value: e.replace(/[+-]/g, ''),
      neg: e.startsWith('-')
    }))
}

function buildSearch(s) {
  return s.map(v => (v.neg ? '-' : '') + v.value).join(', ')
}

function filterMaps(ratedMaps, currentSearch) {
  return ratedMaps
    .filter(m => !currentSearch || filter(currentSearch, m.search))
    .sort(
      (a, b) =>
        Number(filter(currentSearch, b.name.toLowerCase())) - Number(filter(currentSearch, a.name.toLowerCase()))
    )
}

function App() {
  const [isPending, startTransition] = useTransition()
  const shareableRef = useRef(null)
  const poeRegexRef = useRef(null)
  const searchRef = useRef(null)

  const [view, setView] = usePersistedState('view', 'list', startTransition, shareableRef)
  const [searchInput, setSearchInput] = usePersistedState('searchInput', '', startTransition, shareableRef)
  const [layoutInput, setLayoutInput, layoutReset, layoutRef] = useInputField(
    'layoutInput',
    3,
    startTransition,
    shareableRef
  )
  const [densityInput, setDensityInput, densityReset, densityRef] = useInputField(
    'densityInput',
    2,
    startTransition,
    shareableRef
  )
  const [bossInput, setBossInput, bossReset, bossRef] = useInputField('bossInput', 1, startTransition, shareableRef)
  const [cardInput, setCardInput, cardReset, cardRef] = useInputField(
    'cardWeightInput',
    2,
    startTransition,
    shareableRef
  )
  const [cardBaselineInput, setCardBaselineInput, cardBaselineReset] = useInputField(
    'cardBaselineInput',
    defaultCardBaseline,
    startTransition,
    shareableRef
  )
  const [cardBaselineNumberInput, setCardBaselineNumberInput, cardBaselineNumberReset, cardBaselineNumberRef] =
    useInputField('cardBaselineNumberInput', 1, startTransition, shareableRef)
  const [cardMinPriceInput, setCardMinPriceInput, cardMinPriceReset, cardMinPriceRef] = useInputField(
    'cardMinPriceInput',
    10,
    startTransition,
    shareableRef
  )
  const [cardPriceSourceInput, setCardPriceSourceInput, cardPriceSourceReset, cardPriceSourceRef] = useInputField(
    'cardPriceSourceInput',
    'league',
    startTransition,
    shareableRef
  )
  const [cardValueSourceInput, setCardValueSourceInput, cardValueSourceReset, cardValueSourceRef] = useInputField(
    'cardValueSourceInput',
    'map',
    startTransition,
    shareableRef
  )
  const [cardDisplayInput, setCardDisplayInput, cardDisplayReset, cardDisplayRef] = useInputField(
    'cardDisplayInput',
    'all',
    startTransition,
    shareableRef
  )
  const [voidstonesInput, setVoidstonesInput, voidstonesReset, voidstonesRef] = useInputField(
    'voidstonesInput',
    0,
    startTransition,
    shareableRef
  )

  const ratedMaps = useMemo(
    () =>
      rateMaps(
        preparedMaps,
        preparedCards,
        layoutInput,
        densityInput,
        bossInput,
        cardInput,
        cardBaselineInput,
        cardBaselineNumberInput,
        cardMinPriceInput,
        cardPriceSourceInput,
        cardValueSourceInput,
        cardDisplayInput,
        voidstonesInput
      ),
    [
      layoutInput,
      densityInput,
      bossInput,
      cardInput,
      cardBaselineInput,
      cardBaselineNumberInput,
      cardMinPriceInput,
      cardPriceSourceInput,
      cardValueSourceInput,
      cardDisplayInput,
      voidstonesInput
    ]
  )
  const currentSearch = useMemo(() => parseSearch(searchInput), [searchInput])

  const filteredMaps = useMemo(() => filterMaps(ratedMaps, currentSearch), [ratedMaps, currentSearch])

  const poeRegex = useMemo(() => {
    const re = '"' + [...new Set(filteredMaps.map(m => m.shorthand))].join('|') + '"'
    if (re.length > 50) {
      let splitMaps = re.substring(0, 49).split('|')
      return splitMaps.splice(0, splitMaps.length - 1).join('|') + '"'
    }
    return re
  }, [filteredMaps])

  const addToInput = useCallback(
    (v, neg, remove) => {
      let curVal = searchRef.current ? searchRef.current.value : searchInput
      let s = parseSearch(curVal || '')

      if (remove) {
        s = s.filter(sv => sv.value !== v)
      } else {
        const sv = s.find(sv => sv.value === v)
        if (sv) {
          sv.neg = neg
        } else {
          s.push({ value: v, neg: neg })
        }
      }

      const val = buildSearch(s)
      if (searchRef.current) {
        searchRef.current.value = val
      }
      setSearchInput(val)
    },
    [searchInput, setSearchInput, searchRef]
  )

  const inputs = [
    {
      name: 'Layout weight',
      tooltip: (
        <>
          The weight of layout rating when calculating score for map (so end result is map layout * layout weight).
          <br />
          <b>This is not minimal layout rating filter</b>, this will simply push maps with good layouts lower or higher
          in list.
        </>
      ),
      type: 'number',
      ref: layoutRef,
      input: layoutInput,
      setInput: setLayoutInput,
      reset: layoutReset
    },
    {
      name: 'Density weight',
      tooltip: (
        <>
          The weight of density rating when calculating score for map (so end result is map density * density weight).
          <br />
          <b>This is not minimal density rating filter</b>, this will simply push maps with good density lower or higher
          in list.
        </>
      ),
      type: 'number',
      ref: densityRef,
      input: densityInput,
      setInput: setDensityInput,
      reset: densityReset
    },
    {
      name: 'Boss weight',
      tooltip: (
        <>
          The weight of boss rating when calculating score for map (so end result is map boss * boss weight).
          <br />
          <b>This is not minimal boss rating filter</b>, this will simply push maps with good boss lower or higher in
          list.
        </>
      ),
      type: 'number',
      ref: bossRef,
      input: bossInput,
      setInput: setBossInput,
      reset: bossReset
    },
    {
      name: 'Card weight',
      tooltip: (
        <>
          The weight of card rating when calculating score for map (so end result is map card rating * card weight).
          <br />
          <b>This is not minimal card weight filter</b>, this will simply push maps with good cards lower or higher in
          list.
        </>
      ),
      type: 'number',
      ref: cardRef,
      input: cardInput,
      setInput: setCardInput,
      reset: cardReset
    },
    {
      name: 'Card price source',
      tooltip: <>Source of price data, can be either League or Standard.</>,
      type: 'select',
      options: {
        league: 'League',
        standard: 'Standard'
      },
      ref: cardPriceSourceRef,
      input: cardPriceSourceInput,
      setInput: setCardPriceSourceInput,
      reset: cardPriceSourceReset
    },
    {
      name: 'Card value source',
      tooltip: <>How card value is calculated, either based on card map drops or card value from kirac missions.</>,
      type: 'select',
      options: {
        map: 'Map drops',
        kirac: 'Kirac missions'
      },
      ref: cardValueSourceRef,
      input: cardValueSourceInput,
      setInput: setCardValueSourceInput,
      reset: cardValueSourceReset
    },
    {
      name: 'Card display',
      tooltip: <>What cards are displayed/hidden.</>,
      type: 'select',
      options: {
        all: 'All cards',
        high: 'High value only',
        drop: 'Droppable only',
        'high+drop': 'High value and droppable only'
      },
      ref: cardDisplayRef,
      input: cardDisplayInput,
      setInput: setCardDisplayInput,
      reset: cardDisplayReset
    },
    {
      name: 'Minimum card price',
      tooltip: (
        <>
          Minimum price for the card to be considered as something that should be accounted for calculating map score
          and per map value.
          <br />
          Try to not go under <b>6c</b> as <b>poe.ninja</b> tends to overvalue the low cost cards by a lot even though
          when you click on listings the data say something else.
        </>
      ),
      type: 'number',
      ref: cardMinPriceRef,
      input: cardMinPriceInput,
      setInput: setCardMinPriceInput,
      reset: cardMinPriceReset
    },
    {
      name: 'Average card per map',
      tooltip: (
        <>
          The baseline card drop you are expecting to see every map on average with number input next to it. Positive
          number indicates x cards dropped per map, negative number indicates card dropped every x maps.
          <br />
          This is used for calculating how many drop pool items you get on average and that is used for{' '}
          <b>calculating chance to get card per map</b>.
          <br />
          You should set this value to your observed drop rate of index card (for example Union in Cemetery) so the site
          can predict drop rates for your current farming strategy.
        </>
      ),
      type: 'cardselect',
      options: preparedCards
        .sort((a, b) => b.weight - a.weight)
        .map(c => ({ name: c.name + ' (' + c.weight + ')', value: c.name })),
      input: cardBaselineInput,
      setInput: setCardBaselineInput,
      reset: cardBaselineReset,
      numberRef: cardBaselineNumberRef,
      numberInput: cardBaselineNumberInput,
      setNumberInput: setCardBaselineNumberInput,
      numberReset: cardBaselineNumberReset,
      size: 'big'
    },
    {
      name: 'Atlas voidstones',
      tooltip: <>How many voidstones you have. Used for marking cards as droppable or not and determining map tiers.</>,
      type: 'select',
      options: {
        0: '0 voidstones',
        1: '1 voidstone',
        2: '2 voidstones',
        3: '3 voidstones',
        4: '4 voidstones'
      },
      ref: voidstonesRef,
      input: voidstonesInput,
      setInput: setVoidstonesInput,
      reset: voidstonesReset,
      size: 'big'
    },
    {
      name: 'PoE Regex',
      tooltip: (
        <>
          Generates string that can be copy/pasted to Path of Exile search boxes that will search for the filtered maps.
          PoE search fields are limited to 50 characters so the string is truncated to fit the top maps based off search
          criteria.
        </>
      ),
      type: 'copytext',
      ref: poeRegexRef,
      input: poeRegex,
      size: 'big'
    },
    {
      name: 'Shareable link',
      tooltip: <>Share.</>,
      type: 'copytext',
      ref: shareableRef,
      size: 'big'
    }
  ]

  let currentView
  switch (view) {
    case 'atlas':
      currentView = (
        <AtlasView
          view={view}
          setView={setView}
          inputs={inputs}
          ratedMaps={ratedMaps}
          addToInput={addToInput}
          currentSearch={currentSearch}
          searchRef={searchRef}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          voidstonesInput={voidstonesInput}
          cardValueSourceInput={cardValueSourceInput}
        />
      )
      break
    case 'list':
    default:
      currentView = (
        <ListView
          view={view}
          setView={setView}
          inputs={inputs}
          filteredMaps={filteredMaps}
          addToInput={addToInput}
          currentSearch={currentSearch}
          searchRef={searchRef}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          voidstonesInput={voidstonesInput}
          cardValueSourceInput={cardValueSourceInput}
        />
      )
  }

  return (
    <>
      <Loader loading={isPending} />
      <a
        className="btn btn-primary position-fixed top-0 start-0 m-2 on-top"
        href={issueTemplate}
        target="_blank"
        rel="noreferrer"
      >
        <i className="fa-solid fa-fw fa-code-fork" /> Data incorrect or missing? Open an issue
      </a>
      {currentView}
    </>
  )
}

export default App
