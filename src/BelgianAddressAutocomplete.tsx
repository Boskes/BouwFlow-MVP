import { Check, LoaderCircle, MapPin, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { BelgianAddressSuggestion } from './domain'

interface BelgianAddressAutocompleteProps {
  addressLine: string
  postalCode: string
  city: string
  countryCode: string
  onAddressLineChange: (value: string) => void
  onSelect: (suggestion: BelgianAddressSuggestion) => void
  searchAddresses: (query: string, signal?: AbortSignal) => Promise<BelgianAddressSuggestion[]>
}

export default function BelgianAddressAutocomplete({
  addressLine,
  postalCode,
  city,
  countryCode,
  onAddressLineChange,
  onSelect,
  searchAddresses,
}: BelgianAddressAutocompleteProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedValue = useRef('')
  const [suggestions, setSuggestions] = useState<BelgianAddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle')

  const belgian = countryCode.trim().toLocaleUpperCase() === 'BE'
  const query = addressLine.trim()

  useEffect(() => {
    if (!belgian || query.length < 2 || selectedValue.current === query) {
      if (selectedValue.current === query) selectedValue.current = ''
      setSuggestions([])
      setOpen(false)
      setStatus('idle')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('loading')
      void searchAddresses(query, controller.signal)
        .then((results) => {
          setSuggestions(results)
          setActiveIndex(results.length ? 0 : -1)
          setOpen(true)
          setStatus(results.length ? 'ready' : 'empty')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSuggestions([])
          setOpen(true)
          setStatus('error')
        })
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [belgian, query, searchAddresses])

  const select = (suggestion: BelgianAddressSuggestion) => {
    selectedValue.current = suggestion.addressLine
    onSelect(suggestion)
    setSuggestions([])
    setOpen(false)
    setStatus('idle')
  }

  return (
    <div
      className="full belgian-address-field"
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label htmlFor={`${listId}-input`}>Straat en nummer</label>
      <div className={`belgian-address-input ${belgian ? 'enabled' : ''}`}>
        <Search size={16} aria-hidden="true" />
        <input
          id={`${listId}-input`}
          value={addressLine}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          placeholder={belgian ? 'Begin met straat, postcode of gemeente…' : 'Straat en nummer'}
          onFocus={() => { if (status !== 'idle') setOpen(true) }}
          onChange={(event) => {
            selectedValue.current = ''
            onAddressLineChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (!open || !suggestions.length) {
              if (event.key === 'ArrowDown' && suggestions.length) setOpen(true)
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((current) => Math.min(suggestions.length - 1, current + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((current) => Math.max(0, current - 1))
            } else if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault()
              select(suggestions[activeIndex])
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {status === 'loading' && <LoaderCircle className="address-loading" size={16} aria-label="Adressen zoeken" />}
        {status === 'idle' && postalCode && city && <Check className="address-selected" size={16} aria-label="Adresgegevens ingevuld" />}
      </div>
      {belgian && <span className="address-field-hint">Online zoeken in Belgische adressen · handmatig invullen blijft mogelijk</span>}
      {open && (
        <div className="belgian-address-popover">
          {status === 'ready' && (
            <ul id={listId} role="listbox" aria-label="Belgische adressuggesties">
              {suggestions.map((suggestion, index) => (
                <li
                  id={`${listId}-${index}`}
                  key={suggestion.id}
                  role="option"
                  aria-selected={activeIndex === index}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(suggestion)}
                  >
                    <MapPin size={16} aria-hidden="true" />
                    <span>
                      <strong>{suggestion.addressLine}</strong>
                      <small>{suggestion.postalCode} {suggestion.city}{suggestion.province ? ` · ${suggestion.province}` : ''}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {status === 'empty' && <p>Geen adres gevonden. Controleer de schrijfwijze of vul het adres handmatig in.</p>}
          {status === 'error' && <p>De online adresbron is tijdelijk niet bereikbaar. Je kunt gewoon handmatig verdergaan.</p>}
          <footer>Online Belgische adresdata</footer>
        </div>
      )}
    </div>
  )
}
