
import { GoogleGenAI, Type } from "@google/genai";
import { WoundAnalysisResult, CapturedImage, Patient } from "../types";

export const analyzeWound = async (images: CapturedImage[]): Promise<WoundAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let calibrationContext = "";
  try {
    const saved = localStorage.getItem('arrow_wound_patients');
    if (saved) {
      const patients: Patient[] = JSON.parse(saved);
      const corrections = patients
        .flatMap(p => p.assessments)
        .filter(a => a.result.isManualAdjustment && a.result.originalValues)
        .slice(-5);

      if (corrections.length > 0) {
        calibrationContext = "CLINICAL FEEDBACK FROM PREVIOUS SCANS:\n" + corrections.map(c => {
          const orig = c.result.originalValues!;
          return `- AI predicted L:${orig.lengthCm}cm, W:${orig.widthCm}cm. Clinician corrected to L:${c.result.lengthCm}cm, W:${c.result.widthCm}cm.`;
        }).join('\n') + "\nAdjust your pixel-to-cm ratio estimation based on this historical bias.";
      }
    }
  } catch (e) {
    console.warn("Learning loop context failed to load", e);
  }

  const prompt = `
    You are ArrowWound AI, a surgical-grade vision system. 
    TASK: Analyze the provided clinical images of a wound.

    PRECISION CALIBRATION & REFERENCE OBJECTS:
    1. Search the images for one of the following "Reference Markers":
       - A Dime (US 10-cent coin): Known diameter is exactly 17.91mm (1.791cm).
       - A Measuring Ruler: If a ruler is present, read the visible markings to establish the scale.
       - A Calibration Sticker: Typically a 1cm circular marker or QR code.
    2. If a Dime or Ruler is found, it MUST be used as the ground truth for scaling. 
    3. If NO reference object is found, fallback to visual estimation using orientation data and skin texture (less accurate).

    ANALYSIS REQUIREMENTS:
    - Identify exact wound boundaries.
    - Calculate Length (longest axis) and Width (perpendicular to length).
    - Estimate Depth based on oblique angles if available.
    - Classify tissue: Epithelialization (pink), Granulation (red), Slough (yellow), Eschar (black).
    - Observe peri-wound condition.

    ${calibrationContext}

    Return the analysis strictly in JSON format.
  `;

  const imageParts = images.map(img => ({
    inlineData: { data: img.base64, mimeType: "image/jpeg" }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        ...imageParts,
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lengthCm: { type: Type.NUMBER },
          widthCm: { type: Type.NUMBER },
          depthCm: { type: Type.NUMBER },
          areaCm2: { type: Type.NUMBER },
          calibrationMethod: { 
            type: Type.STRING, 
            description: "Set to 'dime', 'ruler', 'sticker' if detected, otherwise 'visual_estimation'." 
          },
          markerDetected: { type: Type.BOOLEAN },
          lengthLine: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ["x", "y"] },
              end: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ["x", "y"] }
            },
            required: ["start", "end"]
          },
          widthLine: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ["x", "y"] },
              end: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ["x", "y"] }
            },
            required: ["start", "end"]
          },
          tissueTypes: {
            type: Type.OBJECT,
            properties: {
              epithelization: { type: Type.NUMBER },
              granulation: { type: Type.NUMBER },
              slough: { type: Type.NUMBER },
              eschar: { type: Type.NUMBER },
            },
            required: ["epithelization", "granulation", "slough", "eschar"]
          },
          periWoundAppearance: { type: Type.STRING },
          clinicalNotes: { type: Type.STRING },
          accuracyConfidence: { type: Type.NUMBER }
        },
        required: ["lengthCm", "widthCm", "depthCm", "areaCm2", "calibrationMethod", "markerDetected", "lengthLine", "widthLine", "tissueTypes", "periWoundAppearance", "clinicalNotes", "accuracyConfidence"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleanJson = jsonMatch ? jsonMatch[0] : text;
  
  return JSON.parse(cleanJson);
};
