'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, type OnboardingPreferences } from '@/contexts/auth-context'

const vibeCards = [
  { id: 'v1', label: 'Concrete & Chrome', category: 'Urban Brutalism', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop', color: 'bg-slate-800' },
  { id: 'v2', label: 'Neon Rain', category: 'Nightlife Cyber', img: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?q=80&w=800&auto=format&fit=crop', color: 'bg-indigo-900' },
  { id: 'v3', label: 'Woven Heritage', category: 'Local Crafts', img: 'https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=800&auto=format&fit=crop', color: 'bg-orange-900' },
  { id: 'v4', label: 'Canopy Filter', category: 'Hidden Nature', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800&auto=format&fit=crop', color: 'bg-emerald-900' },
  { id: 'v5', label: 'Minimalist Brew', category: 'Specialty Coffee', img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop', color: 'bg-stone-800' },
  { id: 'v6', label: 'Midnight Smoke', category: 'Street Food', img: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?q=80&w=800&auto=format&fit=crop', color: 'bg-red-900' },
]

const travelStyles = [
  { id: 'flaneur', title: 'The Flâneur', desc: 'Unstructured urban wandering and low schedule adherence.' },
  { id: 'archivist', title: 'The Archivist', desc: 'Context-first exploration of history and culture.' },
  { id: 'epicurean', title: 'The Epicurean', desc: 'Itinerary driven by food targets and local flavor.' },
  { id: 'synthesizer', title: 'The Synthesizer', desc: 'Modern art, coffee, and design against tradition.' },
]

const preferences = {
  transit: ['Public Rail / BTS', 'Pedestrian Routes', 'Private Rides (Grab)', 'River Ferries', 'Motorcycle Taxis'],
  culinary: ['Street Carts', 'Historic Shophouses', 'Specialty Cafes', 'Mid-tier Local', 'Omakase / Fine Dining'],
  boundaries: ['Tourist Traps', 'High-Density Crowds', 'Chain Establishments', 'Intense Humidity Walks', 'Loud Nightclubs', 'Early Morning Starts'],
}


const totalSteps = 4

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading, saveOnboarding } = useAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [selections, setSelections] = useState<OnboardingPreferences>({
    vibes: [],
    travelStyle: '',
    pace: 50,
    transit: [],
    culinary: [],
    boundaries: [],
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login')
    }
  }, [authLoading, user, router])

  const toggleArrayItem = (key: 'vibes' | 'transit' | 'culinary' | 'boundaries', value: string) => {
    setSelections((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }))
  }

  const stepLabel = useMemo(() => {
    return ['Visual Telemetry', 'Operational Style', 'Rhythm Calibration', 'Parameters & Limits'][step - 1]
  }, [step])

  const submit = async (skipped: boolean) => {
    setSubmitting(true)
    const { error } = await saveOnboarding(selections, { skipped })
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(skipped ? 'Skipped for now. You can edit later in Profile.' : 'Preferences saved successfully!')
    router.push('/')
  }

  if (authLoading || !user) {
    return <div className="flex min-h-[70vh] items-center justify-center text-slate-500">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Personalize your first Bangkok itinerary</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Travel Preference Survey</h1>
              <p className="text-slate-500">Step {step} of {totalSteps} · {stepLabel}</p>
            </div>
            <Button variant="ghost" className="text-slate-700" onClick={() => submit(true)} disabled={submitting}>
              Skip for now
            </Button>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-purple-500" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-8 shadow-xl">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Choose visual vibes you want to experience</h2>
                <p className="text-slate-500">Pick 2-4 styles to guide mood, color, and neighborhoods.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {vibeCards.map((card) => {
                  const selected = selections.vibes.includes(card.id)
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleArrayItem('vibes', card.id)}
                      className={`group relative overflow-hidden rounded-2xl border ${selected ? 'border-amber-400' : 'border-slate-300'} bg-white text-left transition hover:-translate-y-1`}
                      type="button"
                    >
                      <Image src={card.img} alt={card.label} width={600} height={420} className="h-40 w-full object-cover opacity-80 transition group-hover:opacity-100" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm uppercase tracking-wider text-amber-100">{card.category}</p>
                            <h3 className="text-lg font-semibold text-white">{card.label}</h3>
                          </div>
                          {selected && <Check className="h-5 w-5 text-amber-300" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Select your travel archetype</h2>
                <p className="text-slate-500">We will tune recommendations to your decision style.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {travelStyles.map((style) => {
                  const active = selections.travelStyle === style.id
                  return (
                    <button
                      key={style.id}
                      onClick={() => setSelections((prev) => ({ ...prev, travelStyle: style.id }))}
                      className={`rounded-2xl border p-5 text-left transition ${active ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                      type="button"
                    >
                      <h3 className="text-lg font-semibold">{style.title}</h3>
                      <p className="text-sm text-slate-600">{style.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Set your pace</h2>
                <p className="text-slate-500">Slow travel or packed itinerary? Drag the dial.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Slow & flexible</span>
                  <span>Fast & packed</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selections.pace}
                  onChange={(e) => setSelections((prev) => ({ ...prev, pace: Number(e.target.value) }))}
                  className="mt-4 w-full"
                />
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Current</span>
                  <span className="font-semibold text-amber-600">{selections.pace}%</span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {preferences.transit.map((item) => {
                  const active = selections.transit.includes(item)
                  return (
                    <button
                      key={item}
                      onClick={() => toggleArrayItem('transit', item)}
                      className={`rounded-xl border px-4 py-3 text-sm transition ${active ? 'border-amber-400 bg-amber-100' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                      type="button"
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Set boundaries & food priorities</h2>
                <p className="text-slate-500">Tell us what to avoid and what you crave.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Culinary targets</h3>
                  <div className="flex flex-wrap gap-3">
                    {preferences.culinary.map((item) => {
                      const active = selections.culinary.includes(item)
                      return (
                        <button
                          key={item}
                          onClick={() => toggleArrayItem('culinary', item)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-amber-400 bg-amber-100' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                          type="button"
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Avoid</h3>
                  <div className="flex flex-wrap gap-3">
                    {preferences.boundaries.map((item) => {
                      const active = selections.boundaries.includes(item)
                      return (
                        <button
                          key={item}
                          onClick={() => toggleArrayItem('boundaries', item)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-rose-400 bg-rose-100' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                          type="button"
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="ghost"
            className="text-slate-700"
            disabled={step === 1}
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            {step < totalSteps ? (
              <Button onClick={() => setStep((prev) => Math.min(totalSteps, prev + 1))} disabled={submitting}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => submit(false)} disabled={submitting}>
                Save & Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
