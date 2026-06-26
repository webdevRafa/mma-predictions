import { useEffect, useState } from 'react'
import { loadMmaData, type LoadedMmaData } from '../services/mmaData'
import { localEvents, localFighters } from '../data/localData'

interface MmaDataState extends LoadedMmaData {
  loading: boolean
}

const initialState: MmaDataState = {
  fighters: localFighters,
  events: localEvents,
  source: 'local-json',
  loading: true,
}

export function useMmaData(): MmaDataState {
  const [state, setState] = useState<MmaDataState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      const result = await loadMmaData()

      if (isMounted) {
        setState({
          ...result,
          loading: false,
        })
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  return state
}
