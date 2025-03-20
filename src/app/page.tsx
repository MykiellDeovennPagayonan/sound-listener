/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useRef, useCallback, SetStateAction } from "react"
import { Mic, MicOff, Loader2, Volume2, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"

interface RecognizerType {
  listen: (callback: (result: { scores: number[] }) => void, options: any) => void
  stopListening: () => void
  wordLabels: () => string[]
  ensureModelLoaded: () => Promise<void>
}

export default function AudioClassifier() {
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [labels, setLabels] = useState<string[]>([])
  const [predictions, setPredictions] = useState<{ [key: string]: number }>({})
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [modelUrl, setModelUrl] = useState("")
  const [ttsMessage, setTtsMessage] = useState("Keep Quiet")
  const [dominantThreshold, setDominantThreshold] = useState(0.8)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  
  const recognizerRef = useRef<RecognizerType | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)

  const loadScript = useCallback((src: string) => {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      
      const script = document.createElement("script")
      script.src = src
      script.onload = () => resolve()
      script.onerror = reject
      document.body.appendChild(script)
    })
  }, [])

  const createModel = useCallback(async (url: string) => {
    if (!url) throw new Error("Model URL is required")
    
    const normalizedUrl = url.endsWith("/") ? url : `${url}/`
    const checkpointURL = normalizedUrl + "model.json"
    const metadataURL = normalizedUrl + "metadata.json"

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const recognizer = window.speechCommands.create("BROWSER_FFT", undefined, checkpointURL, metadataURL)

    await recognizer.ensureModelLoaded()
    return recognizer
  }, [])

  const initModel = useCallback(async () => {
    if (!modelUrl) return
    
    try {
      setIsLoading(true)
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js")
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.4.0/dist/speech-commands.min.js",
      )
      
      const recognizer = await createModel(modelUrl)
      recognizerRef.current = recognizer
      const classLabels = recognizer.wordLabels()
      setLabels(classLabels)
      setIsModelLoaded(true)
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to initialize model:", error)
      setIsLoading(false)
    }
  }, [loadScript, createModel, modelUrl])

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis
  }, [])

  const speakMessage = useCallback(() => {
    if (speechSynthesisRef.current && ttsEnabled) {
      speechSynthesisRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(ttsMessage)
      speechSynthesisRef.current.speak(utterance)
    }
  }, [ttsEnabled, ttsMessage])

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

        if (labels.length > 1 && scores[1] > dominantThreshold) {
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
  }, [isListening, labels, speakMessage, dominantThreshold])

  const handleLoadModel = () => {
    initModel()
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Audio Classifier</CardTitle>
      </CardHeader>
      <CardContent>
        {!isModelLoaded ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-url">Teachable Machine URL</Label>
              <div className="flex gap-2">
                <Input
                  id="model-url"
                  placeholder="Your teachable machine URL here"
                  value={modelUrl}
                  onChange={(e: { target: { value: SetStateAction<string> } }) => setModelUrl(e.target.value)}
                />
                <Button onClick={handleLoadModel} disabled={isLoading || !modelUrl}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading audio model...</span>
              </div>
            )}
          </div>
        ) : (
          <>
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

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="tts-message">TTS Message</Label>
                <Input
                  id="tts-message"
                  value={ttsMessage}
                  onChange={(e: { target: { value: SetStateAction<string> } }) => setTtsMessage(e.target.value)}
                  disabled={isListening}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="threshold">Threshold: {(dominantThreshold * 100).toFixed(0)}%</Label>
                </div>
                <Slider
                  id="threshold"
                  min={0}
                  max={100}
                  step={1}
                  value={[dominantThreshold * 100]}
                  onValueChange={(value: number[]) => setDominantThreshold(value[0] / 100)}
                  disabled={isListening}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="tts-mode" checked={ttsEnabled} onCheckedChange={setTtsEnabled} disabled={isListening} />
                <Label htmlFor="tts-mode">Text-to-Speech {ttsEnabled ? "Enabled" : "Disabled"}</Label>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {labels.map((label, index) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{label} {index === 1 && "(Dominant)"}</span>
                    <span className="font-semibold">{(predictions[label] || 0).toFixed(2)}</span>
                  </div>
                  <Progress
                    value={(predictions[label] || 0) * 100}
                    className={`h-2 ${index === 1 ? "bg-yellow-200" : ""}`}
                  />
                </div>
              ))}
            </div>

            {ttsEnabled && (
              <div className="mt-4 p-2 bg-yellow-100 rounded-md flex items-center">
                <Volume2 className="h-4 w-4 mr-2 text-yellow-700" />
                <span className="text-sm text-yellow-700">
                  TTS will say &quot;{ttsMessage}&quot; when {labels[1] || "2nd class"} is above{" "}
                  {dominantThreshold * 100}%
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}