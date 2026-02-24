import React, { useState, useEffect, useRef } from "react"
import {
  Radio,
  Activity,
  Sparkles,
  Wind,
  Upload,
  Music,
  Wand2,
  X,
} from "lucide-react"

// --- Gemini API Configuration ---
// const apiKey = process.env.REACT_APP_GEMINI_API_KEY || ""
// const GEN_MODEL = "gemini-2.5-flash-preview-09-2025"

const App = () => {
  const [activeMode, setActiveMode] = useState("rings")
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [armRotation, setArmRotation] = useState(0) // 0 is resting (5 o'clock)
  const [isDragging, setIsDragging] = useState(false)
  const [audioError, setAudioError] = useState(false)

  // Track State
  const [trackUrl, setTrackUrl] = useState("")
  const [trackName, setTrackName] = useState("No Track Loaded")

  // const [aiVibe, setAiVibe] = useState(null)
  // const [isAnalyzing, setIsAnalyzing] = useState(false)

  const canvasRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const gainNodeRef = useRef(null)
  const audioRef = useRef(null)
  const requestRef = useRef(null)
  const pivotRef = useRef(null)
  const fileInputRef = useRef(null)

  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options)
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)
      return await response.json()
    } catch (err) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoff))
        return fetchWithRetry(url, options, retries - 1, backoff * 2)
      }
      throw err
    }
  }

  // const analyzeVibe = async () => {
  //   if (isAnalyzing || !trackUrl) return
  //   setIsAnalyzing(true)
  //   const systemPrompt = `Analyze track and return JSON: mood, vibeDescription, recommendedMode (rings, bars, stars, flow), colorHex.`
  //   const userQuery = `Analyze: "${trackName}"`
  //   try {
  //     const result = await fetchWithRetry(
  //       `https://generativelanguage.googleapis.com/v1beta/models/${GEN_MODEL}:generateContent?key=${apiKey}`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           contents: [{ parts: [{ text: userQuery }] }],
  //           systemInstruction: { parts: [{ text: systemPrompt }] },
  //           generationConfig: { responseMimeType: "application/json" },
  //         }),
  //       },
  //     )
  //     const aiResponse = JSON.parse(result.candidates[0].content.parts[0].text)
  //     setAiVibe(aiResponse)
  //     setActiveMode(aiResponse.recommendedMode)
  //   } catch (error) {
  //     console.error("AI Analysis failed", error)
  //   } finally {
  //     setIsAnalyzing(false)
  //   }
  // }

  const initAudio = (url) => {
    if (!url) return
    if (audioContextRef.current) {
      if (audioRef.current && audioRef.current.src !== url) {
        audioRef.current.src = url
        audioRef.current.load()
        if (isPlaying) audioRef.current.play().catch(() => {})
      }
      return
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      const gainNode = ctx.createGain()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      gainNode.gain.value = volume
      const audio = new Audio()
      audio.src = url
      audio.crossOrigin = "anonymous"
      audio.loop = true
      audio.onerror = () => setAudioError(true)
      const source = ctx.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(gainNode)
      gainNode.connect(ctx.destination)
      audioContextRef.current = ctx
      analyserRef.current = analyser
      gainNodeRef.current = gainNode
      audioRef.current = audio
      setAudioError(false)
    } catch (err) {
      setAudioError(true)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setTrackUrl(url)
      setTrackName(file.name)
      setAudioError(false)
      // setAiVibe(null)
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.load()
        if (isPlaying) audioRef.current.play().catch(() => {})
      } else {
        initAudio(url)
      }
    }
  }

  useEffect(() => {
    const isOnRecord = armRotation > 35 && armRotation <= 90
    if (isOnRecord && !isPlaying && !audioError && trackUrl) {
      if (audioContextRef.current?.state === "suspended")
        audioContextRef.current.resume()
      audioRef.current?.play().catch(() => {})
      setIsPlaying(true)
    } else if ((!isOnRecord || !trackUrl) && isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d")
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [armRotation, isPlaying, audioError, trackUrl])

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume
  }, [volume])

  const handleStartDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (trackUrl) initAudio(trackUrl)
    setIsDragging(true)
  }

  const handleDrag = (e) => {
    if (!isDragging || !pivotRef.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const pivotRect = pivotRef.current.getBoundingClientRect()
    const pivotX = pivotRect.left + pivotRect.width / 2
    const pivotY = pivotRect.top + pivotRect.height / 2

    const angleRad = Math.atan2(clientY - pivotY, clientX - pivotX)
    let angleDeg = (angleRad * 180) / Math.PI

    // 5 o'clock is ~60 degrees
    let rotation = angleDeg - 60

    if (rotation < -180) rotation += 360
    if (rotation > 180) rotation -= 360

    const minRot = 0
    const maxRot = 90

    if (rotation < minRot) rotation = minRot
    if (rotation > maxRot) rotation = maxRot

    setArmRotation(rotation)
  }

  const handleStopDrag = () => setIsDragging(false)

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDrag)
      window.addEventListener("mouseup", handleStopDrag)
      window.addEventListener("touchmove", handleDrag, { passive: false })
      window.addEventListener("touchend", handleStopDrag)
    }
    return () => {
      window.removeEventListener("mousemove", handleDrag)
      window.removeEventListener("mouseup", handleStopDrag)
      window.removeEventListener("touchmove", handleDrag)
      window.removeEventListener("touchend", handleStopDrag)
    }
  }, [isDragging])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      requestRef.current = requestAnimationFrame(draw)
      return
    }
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!isPlaying || !analyserRef.current) {
      requestRef.current = requestAnimationFrame(draw)
      return
    }

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const baseRadius = 65

    let sum = 0
    for (let i = 0; i < 40; i++) sum += dataArray[i]
    const avgIntensity = sum / (40 * 255)

    const activeColor =
      // aiVibe?.colorHex ||
      activeMode === "bars"
        ? "#ec4899"
        : activeMode === "flow"
          ? "#06b6d4"
          : activeMode === "stars"
            ? "#9333ea"
            : "#3b82f6"

    const rgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : "255, 255, 255"
    }

    if (activeMode === "bars") {
      const barCount = 64
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2
        const val = Math.pow(dataArray[i % 40] / 255, 1.4)
        const barLen = val * 70 + avgIntensity * 30
        if (barLen < 2) continue
        ctx.beginPath()
        ctx.lineWidth = 4
        ctx.lineCap = "round"
        ctx.strokeStyle = `rgba(${rgb(activeColor)}, ${0.3 + val * 0.7})`
        ctx.moveTo(
          centerX + Math.cos(angle) * baseRadius,
          centerY + Math.sin(angle) * baseRadius,
        )
        ctx.lineTo(
          centerX + Math.cos(angle) * (baseRadius + barLen),
          centerY + Math.sin(angle) * (baseRadius + barLen),
        )
        ctx.stroke()
      }
    } else if (activeMode === "flow") {
      ctx.save()
      ctx.beginPath()
      ctx.shadowBlur = 15
      ctx.shadowColor = `rgba(${rgb(activeColor)}, 0.8)`
      const points = 64
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const radius =
          baseRadius + (dataArray[i % 25] / 255) * 55 + avgIntensity * 40
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      const grad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        130,
      )
      grad.addColorStop(0, `rgba(${rgb(activeColor)}, 0.7)`)
      grad.addColorStop(1, `rgba(${rgb(activeColor)}, 0)`)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    } else if (activeMode === "stars") {
      const rotation = Date.now() * 0.0003
      const rayCount = 20

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + rotation
        const petalWidth = ((Math.PI * 2) / rayCount) * 0.8

        const sampleIdx = Math.floor((i * 4) % 100)
        // Increased exponent (1.2 -> 2.8) to make troughs smaller and peaks more aggressive
        const val = Math.pow(dataArray[sampleIdx] / 255, 1)

        // Capped total expansion to ~175px radius. Higher val multiplier (65 -> 100) for greater peaks.
        // Reduced constant offset (10 -> 2) for smaller troughs.
        const outerRadius = baseRadius + 2 + val * 100 + avgIntensity * 10

        ctx.save()
        ctx.beginPath()

        const xBase = centerX + Math.cos(angle) * baseRadius
        const yBase = centerY + Math.sin(angle) * baseRadius

        const cpAngle1 = angle - petalWidth
        const cpAngle2 = angle + petalWidth
        const cpDist = baseRadius + (outerRadius - baseRadius) * 0.5

        const tipArcWidth = 0.15
        const xTipL =
          centerX + Math.cos(angle - tipArcWidth * petalWidth) * outerRadius
        const yTipL =
          centerY + Math.sin(angle - tipArcWidth * petalWidth) * outerRadius
        const xTipR =
          centerX + Math.cos(angle + tipArcWidth * petalWidth) * outerRadius
        const yTipR =
          centerY + Math.sin(angle + tipArcWidth * petalWidth) * outerRadius
        const xTipActual = centerX + Math.cos(angle) * (outerRadius + 5)
        const yTipActual = centerY + Math.sin(angle) * (outerRadius + 5)

        const cp1x = centerX + Math.cos(cpAngle1) * cpDist
        const cp1y = centerY + Math.sin(cpAngle1) * cpDist

        const cp2x = centerX + Math.cos(cpAngle2) * cpDist
        const cp2y = centerY + Math.sin(cpAngle2) * cpDist

        ctx.moveTo(xBase, yBase)
        ctx.quadraticCurveTo(cp1x, cp1y, xTipL, yTipL)
        ctx.quadraticCurveTo(xTipActual, yTipActual, xTipR, yTipR)
        ctx.quadraticCurveTo(cp2x, cp2y, xBase, yBase)

        const petalGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          baseRadius,
          centerX,
          centerY,
          outerRadius + 5,
        )
        petalGrad.addColorStop(0, `rgba(${rgb(activeColor)}, 0.7)`)
        petalGrad.addColorStop(0.8, `rgba(${rgb(activeColor)}, 0.2)`)
        petalGrad.addColorStop(1, `rgba(${rgb(activeColor)}, 0)`)

        ctx.fillStyle = petalGrad
        ctx.fill()

        ctx.strokeStyle = `rgba(${rgb(activeColor)}, ${0.1 + val * 0.3})`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.restore()

        const trebleVal = dataArray[150 + (i % 20)] / 255
        if (trebleVal > 0.5) {
          ctx.beginPath()
          ctx.fillStyle = `rgba(255, 255, 255, ${trebleVal - 0.2})`
          ctx.arc(xTipActual, yTipActual, 1 + trebleVal * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (activeMode === "rings") {
      const ringCount = 5
      for (let i = 0; i < ringCount; i++) {
        const val = Math.pow(dataArray[i * 10] / 255, 1.3)
        ctx.beginPath()
        const ringRadius = baseRadius + i * 10 + val * 35 + avgIntensity * 25
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${rgb(activeColor)}, ${0.2 + val * 0.8})`
        ctx.lineWidth = 2 + val * 6
        ctx.stroke()
      }
    }
    requestRef.current = requestAnimationFrame(draw)
  }

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(requestRef.current)
  }, [activeMode, isPlaying]) // removed aiVibe since it's commented out

  return (
    <div className="flex flex-col items-center bg-[#b8bdc7] min-h-screen py-10 px-4 select-none overflow-y-auto font-sans">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* HEADER */}
        <div className="w-full mb-8 flex items-center justify-between px-6 shrink-0 relative">
          <div className="flex items-center gap-3 bg-[#cbd2db] px-6 py-2 rounded-full shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff] max-w-[70%] border border-white/20">
            <Music
              className={`w-5 h-5 shrink-0 ${isPlaying ? "text-pink-500 animate-pulse" : "text-gray-500"}`}
            />
            <div className="overflow-hidden relative flex-1 min-w-0">
              <span
                className={`whitespace-nowrap inline-block text-sm font-bold text-gray-700 ${trackName !== "No Track Loaded" && trackName.length > 30 ? "animate-[scroll_10s_linear_infinite]" : ""}`}
              >
                {trackName}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-[#cbd2db] px-4 py-2 rounded-full shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff] shrink-0 border border-white/10">
            {isPlaying ? "Now Playing" : "Stopped"}
          </div>
        </div>

        {/* MAIN CONSOLE */}
        <div className="relative bg-[#cbd2db] w-full aspect-[1.6/1] rounded-[40px] shadow-[20px_20px_60px_#9ea4ad,-20px_-20px_60px_#f8fcff] flex items-center p-12 gap-12 border border-[#d1d8e0] shrink-0">
          <div className="flex flex-col gap-4 z-10 h-full justify-center">
            <ModeButton
              active={activeMode === "rings"}
              onClick={() => setActiveMode("rings")}
              color="blue"
              icon={<Radio className="w-6 h-6" />}
            />
            <ModeButton
              active={activeMode === "bars"}
              onClick={() => setActiveMode("bars")}
              color="pink"
              icon={<Activity className="w-6 h-6" />}
            />
            <ModeButton
              active={activeMode === "stars"}
              onClick={() => setActiveMode("stars")}
              color="purple"
              icon={<Sparkles className="w-6 h-6" />}
            />
            <ModeButton
              active={activeMode === "flow"}
              onClick={() => setActiveMode("flow")}
              color="cyan"
              icon={<Wind className="w-6 h-6" />}
            />
            <div className="mt-4 pt-4 border-t border-gray-400/30 flex flex-col gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="audio/*"
                className="hidden"
              />
              <ModeButton
                active={false}
                onClick={() => fileInputRef.current.click()}
                color="gray"
                icon={<Upload className="w-6 h-6" />}
                tooltip="Upload Music"
              />
              {/* <ModeButton
                active={isAnalyzing}
                onClick={analyzeVibe}
                color="gold"
                icon={
                  isAnalyzing ? (
                    <div className="animate-spin text-yellow-600">✨</div>
                  ) : (
                    <Wand2 className="w-6 h-6 text-yellow-600" />
                  )
                }
                tooltip="✨ AI Analysis"
              /> */}
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center h-full">
            {/* {aiVibe && (
              <div className="absolute top-0 left-0 right-0 z-[120] flex justify-center animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
                <div className="bg-[#cbd2db]/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-white/30 flex flex-col items-center relative pointer-events-auto min-w-[200px]">
                  <button
                    onClick={() => setAiVibe(null)}
                    className="absolute -top-2 -right-2 p-1.5 bg-gray-400/80 text-white rounded-full shadow-lg hover:bg-gray-500 transition-all active:scale-90"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      ✨ AI Insight
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase"
                      style={{ backgroundColor: aiVibe.colorHex }}
                    >
                      {aiVibe.mood}
                    </span>
                  </div>
                  <p className="text-xs italic text-gray-700 text-center font-medium">
                    "{aiVibe.vibeDescription}"
                  </p>
                </div>
              </div>
            )} */}

            <div className="absolute w-[min(440px,100%)] aspect-square rounded-full bg-[#cbd2db] shadow-[inset_10px_10px_20px_#9ea4ad,inset_-10px_-10px_20px_#f8fcff] flex items-center justify-center">
              <div
                className={`relative w-[min(360px,85%)] aspect-square rounded-full bg-[#181a1d] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-center transition-transform duration-1000 ${isPlaying ? "animate-[spin_4s_linear_infinite]" : ""}`}
                style={{
                  backgroundImage: `repeating-radial-gradient(circle, #181a1d, #181a1d 2px, #202327 3.5px, #181a1d 4px)`,
                }}
              >
                <div className="relative w-[30%] aspect-square rounded-full bg-white shadow-inner flex items-center justify-center">
                  <div className="w-[30%] aspect-square rounded-full bg-[#181a1d] z-10 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.2)]"></div>
                </div>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={400}
                  className="absolute z-20 pointer-events-none w-full h-full"
                />
              </div>
            </div>

            {/* TONEARM ASSEMBLY */}
            <div className="absolute top-4 right-7 pointer-events-none w-64 h-64 flex items-start justify-end">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full bg-[#cbd2db] shadow-[8px_8px_16px_#9ea4ad,-8px_-8px_16px_#f8fcff] flex items-center justify-center z-[70]">
                  <div className="w-16 h-16 rounded-full bg-[#cbd2db] shadow-[inset_4px_4px_8px_#9ea4ad,inset_-4px_-4px_8px_#f8fcff] flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#dee2e6] to-[#adb5bd] border border-white/40 shadow-sm"></div>
                  </div>
                </div>

                <div
                  ref={pivotRef}
                  className="absolute inset-0 rounded-full z-[100]"
                />

                <div
                  className="absolute z-[90]"
                  style={{ transform: `rotate(${armRotation}deg)` }}
                >
                  <div
                    className="relative flex items-center"
                    style={{ transform: "rotate(70deg)" }}
                  >
                    <div className="absolute left-0 w-80 h-3.5 bg-gradient-to-b from-[#f8f9fa] to-[#ced4da] rounded-full shadow-xl flex items-center border-y border-white/20">
                      <div
                        onMouseDown={handleStartDrag}
                        onTouchStart={handleStartDrag}
                        className="absolute right-0 -top-6 w-24 h-16 pointer-events-auto cursor-grab active:cursor-grabbing flex items-center justify-start translate-x-12"
                      >
                        <div className="w-16 h-10 bg-[#cbd2db] rounded-md shadow-lg border border-white/40 relative flex flex-col items-center justify-center overflow-hidden z-10">
                          <div className="w-10 h-0.5 bg-gray-500 rounded-full mb-1 opacity-50"></div>
                          <div className="w-10 h-0.5 bg-gray-500 rounded-full mb-1 opacity-50"></div>
                          <div className="w-10 h-0.5 bg-gray-500 rounded-full opacity-50"></div>
                          <div className="absolute left-0.5 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-400 to-gray-600"></div>
                        </div>
                        <div className="absolute left-4 -top-3 w-8 h-4 border-t-2 border-r-2 border-gray-400 rounded-tr-xl opacity-80 z-20"></div>
                        <div className="absolute bottom-0 left-6 w-2.5 h-4 bg-[#212529] rounded-b-sm shadow-sm"></div>
                      </div>
                      <div className="absolute left-0 w-18 h-12 bg-gradient-to-r from-[#212529] to-[#495057] rounded-lg shadow-2xl border-r border-white/10 flex items-center justify-center -translate-x-4 z-10">
                        <div className="w-full h-0.5 bg-white/10"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VOLUME */}
          <div className="relative w-28 h-[400px] bg-[#111315] rounded-[30px] shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),10px_10px_20px_rgba(0,0,0,0.2)] p-6 flex flex-col items-center gap-4">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
              Volume
            </span>
            <div className="relative flex-1 w-full flex justify-center">
              <div className="absolute w-[2px] h-full bg-[#343a40]"></div>
              <div className="absolute inset-0 flex flex-col justify-between py-2 text-[9px] text-gray-600 font-mono pointer-events-none">
                {["+", "4", "1", "0", "1", "2", "3", "4", "-"].map((m, idx) => (
                  <span key={`${m}-${idx}`} className="text-center">
                    {m}
                  </span>
                ))}
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="vertical-range absolute h-full w-full opacity-0 cursor-pointer z-20"
                style={{ appearance: "slider-vertical" }}
              />
              <div
                className="absolute w-12 h-16 bg-[#dee2e6] rounded-xl shadow-lg border-t border-white/40 pointer-events-none flex flex-col items-center justify-center gap-1 transition-all duration-75"
                style={{ bottom: `calc(${volume * 100}% - 32px)` }}
              >
                <div className="w-6 h-[2.5px] bg-[#adb5bd] rounded-full"></div>
                <div className="w-6 h-[2.5px] bg-[#adb5bd] rounded-full"></div>
                <div className="w-6 h-[2.5px] bg-[#adb5bd] rounded-full"></div>
              </div>
            </div>
            <div
              className={`w-3.5 h-3.5 rounded-full shadow-[0_0_12px_#22c55e] transition-colors duration-500 ${isPlaying ? "bg-[#22c55e]" : "bg-gray-800"}`}
            ></div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .vertical-range { writing-mode: bt-lr; appearance: slider-vertical; }
        input[type=range]::-webkit-slider-thumb { appearance: none; width: 100%; height: 40px; }
      `,
        }}
      />

      {audioError && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur-md px-8 py-4 rounded-full text-white font-semibold shadow-2xl z-[150]">
          Audio failed to load.
        </div>
      )}
      {!trackUrl && !audioError && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-indigo-500/90 backdrop-blur-md px-8 py-4 rounded-full text-white font-semibold shadow-2xl z-[150] animate-pulse">
          Upload a song to begin
        </div>
      )}
      {trackUrl && !isPlaying && armRotation < 10 && !audioError && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md px-8 py-4 rounded-full border border-white/30 text-[#343a40] font-semibold animate-bounce shadow-2xl z-[150]">
          Drag the headshell onto the vinyl to play
        </div>
      )}
    </div>
  )
}

const ModeButton = ({ active, onClick, color, icon, tooltip }) => {
  const themes = {
    pink: active
      ? "bg-pink-500 text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
    blue: active
      ? "bg-blue-500 text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
    purple: active
      ? "bg-purple-600 text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
    cyan: active
      ? "bg-cyan-500 text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
    gray: "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
    gold: active
      ? "bg-yellow-400 text-yellow-900 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)]"
      : "bg-[#cbd2db] text-[#495057] shadow-[5px_5px_10px_#9ea4ad,-5px_-5px_10px_#f8fcff]",
  }
  return (
    <button
      title={tooltip}
      onClick={onClick}
      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95 ${themes[color]}`}
    >
      {icon}
    </button>
  )
}

export default App
