/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface RecognizerType {
  listen: (callback: (result: { scores: number[] }) => void, options: any) => void
  stopListening: () => void
  wordLabels: () => string[]
}

const DOMINANT_CLASS = "Class 2"
const DOMINANT_THRESHOLD = 0.8
const TTS_MESSAGE = "Keep Quiet"

export default function AudioClassifier() {
  const [isLoading, setIsLoading] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [labels, setLabels] = useState<string[]>([])
  const [predictions, setPredictions] = useState<{ [key: string]: number }>({})
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const recognizerRef = useRef<RecognizerType | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)

  const loadScript = useCallback((src: string) => {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = src
      script.onload = () => resolve()
      script.onerror = reject
      document.body.appendChild(script)
    })
  }, [])

  const createModel = useCallback(async () => {
    const URL = "https://teachablemachine.withgoogle.com/models/9qDrS2lTS/"
    const checkpointURL = URL + "model.json"
    const metadataURL = URL + "metadata.json"

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore (since we're loading speechCommands globally)
    const recognizer = window.speechCommands.create("BROWSER_FFT", undefined, checkpointURL, metadataURL)

    await recognizer.ensureModelLoaded()
    return recognizer
  }, [])

  const initModel = useCallback(async () => {
    try {
      const recognizer = await createModel()
      recognizerRef.current = recognizer
      const classLabels = recognizer.wordLabels()
      setLabels(classLabels)
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to initialize model:", error)
      setIsLoading(false)
    }
  }, [createModel])

  useEffect(() => {
    const loadScripts = async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js")
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.4.0/dist/speech-commands.min.js",
        )
        await initModel()
      } catch (error) {
        console.error("Failed to load scripts:", error)
        setIsLoading(false)
      }
    }

    loadScripts()
    speechSynthesisRef.current = window.speechSynthesis
  }, [loadScript, initModel])

  const speakMessage = useCallback(() => {
    if (speechSynthesisRef.current && ttsEnabled) {
      speechSynthesisRef.current.cancel() // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(TTS_MESSAGE)
      speechSynthesisRef.current.speak(utterance)
    }
  }, [ttsEnabled])

  const toggleListening = useCallback(async () => {
    if (!recognizerRef.current) return

    if (isListening) {
      recognizerRef.current.stopListening()
      setIsListening(false)
      return
    }

    setIsListening(true)
    recognizerRef.current.listen(
      (result: { scores: number[] }) => {
        const scores = result.scores
        const newPredictions: { [key: string]: number } = {}

        labels.forEach((label, index) => {
          newPredictions[label] = scores[index]
        })

        setPredictions(newPredictions)

        // Check if DOMINANT_CLASS is dominant
        if (newPredictions[DOMINANT_CLASS] > DOMINANT_THRESHOLD) {
          speakMessage()
        }
      },
      {
        includeSpectrogram: true,
        probabilityThreshold: 0.75,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.15,
      },
    )
  }, [isListening, labels, speakMessage])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2 text-lg">Loading audio model...</span>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Audio Classifier</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={toggleListening}
          className={`w-full ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
        >
          {isListening ? (
            <>
              <MicOff className="mr-2 h-4 w-4" /> Stop Listening
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" /> Start Listening
            </>
          )}
        </Button>

        <div className="flex items-center space-x-2 mt-4">
          <Switch id="tts-mode" checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
          <Label htmlFor="tts-mode">Text-to-Speech {ttsEnabled ? "Enabled" : "Disabled"}</Label>
        </div>

        <div className="mt-6 space-y-4">
          {labels.map((label) => (
            <div key={label} className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">{label}</span>
                <span className="font-semibold">{(predictions[label] || 0).toFixed(2)}</span>
              </div>
              <Progress
                value={(predictions[label] || 0) * 100}
                className={`h-2 ${label === DOMINANT_CLASS ? "bg-yellow-200" : ""}`}
              />
            </div>
          ))}
        </div>

        {ttsEnabled && (
          <div className="mt-4 p-2 bg-yellow-100 rounded-md flex items-center">
            <Volume2 className="h-4 w-4 mr-2 text-yellow-700" />
            <span className="text-sm text-yellow-700">
              TTS will say &quot;{TTS_MESSAGE}&quot; when {DOMINANT_CLASS} is above {DOMINANT_THRESHOLD * 100}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}