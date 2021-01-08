import {
  FunctionalComponent,
  h,
} from 'preact'
import styles from './index.scss'
import {
  authStore,
  lobbyStore,
} from '../../store'
import {
  observer, 
} from 'mobx-react-lite'
// import {
//   SafeLobby, 
// } from '/@/../@types/Lobby'
import {
  useEffect,
  useRef, 
} from 'preact/hooks'
import {
  pixi,
  CardObject,
} from '../../utils'
import {
  SafeLobby, 
  Player, 
} from '@types'

const margin = 5

const hands: Record<string, {
  player: Player
  hand: CardObject[]
  index: number
}> = {}

let discard: CardObject = null

const draw: CardObject = new CardObject({
  type: 0,
  color: 'red',
})

draw.isHoverable = true

draw.flipped = true

// should be optimized better, but will probably be okay
const isInGame = () => Object.values(hands).find(({ player }) => player.nickname === authStore.nickname)

const generateHands = (lobby: SafeLobby): void => {
  lobby.players.forEach((player, playerIndex) => {
    const cards = player.hand.map(card => new CardObject(card))

    hands[player.nickname] = {
      hand: cards,
      player,
      index: playerIndex,
    }
  })
}

const alignCardToHand = (card: CardObject, length: number, playerIndex: number, cardIndex: number) => {
  const { clientWidth: width, clientHeight: height } = pixi.view.parentElement

  card.flipped = true

  switch (playerIndex) {
    case 0: {
      if (isInGame()) {
        const offset = (width / 2) - ((length - 1) / 2 * (card.width + margin))

        card.flipped = false
  
        // card.y = height - (card.height / 2) - margin
        // card.x = offset + ((card.width + margin) * cardIndex)
        card.moveTo(offset + ((card.width + margin) * cardIndex), height - (card.height / 2) - margin)
      } else {
        const offset = (width / 2) - ((length - 1) / 2 * (card.width / 2 + margin))
  
        card.y = height
        card.x = offset + ((card.width / 2 + margin) * cardIndex)
      }

      break
    }

    case 1: {
      const offset = (height / 2) - ((length - 1) / 2 * (card.width / 2 + margin))

      card.rotation = 0.5

      card.y = offset + ((card.width / 2 + margin) * cardIndex)
      card.x = 0

      break
    }

    case 2: {
      const offset = (width / 2) - ((length - 1) / 2 * (card.width / 2 + margin))

      card.rotation = 1

      card.y = 0
      card.x = offset + ((card.width / 2 + margin) * cardIndex)

      break
    }

    case 3: {
      const offset = (height / 2) - ((length - 1) / 2 * (card.width / 2 + margin))

      card.rotation = 1.5

      card.y = offset + ((card.width / 2 + margin) * cardIndex)
      card.x = width

      break
    }
  }

  card.update()
}

const alignHands = () => {
  const values = Object.values(hands)

  if (isInGame()) {
    while (values[0].player.nickname !== authStore.nickname) {
      values.push(values.shift())
    }
  }

  values.forEach(({ hand }, playerIndex) => {
    hand.forEach((card, cardIndex) => {
      alignCardToHand(card, hand.length, playerIndex, cardIndex)
    })
  })
}

const generateDiscardPile = (lobby: SafeLobby) => {
  if (discard) discard.destroy()

  discard = new CardObject(lobby.discard.slice(-1)[0])
}

const alignDiscardDrawPiles = () => {
  if (!discard) return

  const { clientWidth: width, clientHeight: height } = pixi.view.parentElement

  discard.x = width / 2
  discard.y = height / 2

  draw.y = discard.y
  draw.x = discard.x - draw.width - 20

  discard.update()
  draw.update()
}

const align = () => {
  alignHands()
  alignDiscardDrawPiles()
}

const testMatchingCards = (lobby: SafeLobby) => {
  const isMyTurn = true

  let hasPlayableCard = false

  hands[authStore.nickname].hand.forEach((card) => {
    const [lastCard] = lobby.discard.slice(-1)

    const isSpecialCard = card.color === 'special'
    const isSameType = card.type === lastCard.type
    const isSameColor = card.color === lastCard.color

    if (isMyTurn && (isSpecialCard || isSameColor || isSameType)) {
      card.container.alpha = 1
      card.isHoverable = true

      hasPlayableCard = true

      if (card.mousedownListener) return

      card.mousedownListener = async () => {
        card.moveTo(discard.x, discard.y)
        
        const index = hands[authStore.nickname].hand.findIndex(({ symbol }) => symbol === card.symbol)
  
        hands[authStore.nickname].hand.splice(index, 1)
  
        alignHands()
  
        await card.rotate(discard.rotation)
        discard.type = card.type
        discard.color = card.color
  
        discard.update()
        card.destroy()

        testMatchingCards(lobby)
      }
  
      card.graphics.addListener('mousedown', card.mousedownListener)
    } else {
      card.container.alpha = 0.4
      card.isHoverable = false
      card.graphics.removeListener('mousedown', card.mousedownListener)
      card.mousedownListener = null
    }
  })

  if (!hasPlayableCard) {
    draw.container.alpha = 1
    draw.isHoverable = true
  } else {
    draw.container.alpha = 0.4
    draw.isHoverable = false
  }
}

window.addEventListener('resize', align)

const init = (lobby: SafeLobby) => {
  generateDiscardPile(lobby)
  generateHands(lobby)
  align()
  testMatchingCards(lobby)
}

export const Room: FunctionalComponent = observer((props: {
  name: string
}) => {
  const lobby = lobbyStore.list.find(lobby => lobby.name === props.name)
  const pixiContainer = useRef(null)

  useEffect(() => {
    if (!pixiContainer || !lobby || !authStore.nickname) return

    pixiContainer.current.appendChild(pixi.view)
    pixi.resizeTo = pixiContainer.current

    init(lobby)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiContainer, lobby, authStore.nickname])

  return <div className={styles.room}>
    <div className={styles.container} ref={pixiContainer} />
  </div>
})
