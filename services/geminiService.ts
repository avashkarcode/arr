
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
    You are ArrowWound AI. Analyze ${images.length} images.
    ${calibrationContext}
    1. Identify Wound Edges.
    2. Estimate measurements using orientation data and visual cues.
    3. Return exact JSON following the schema.
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
        required: ["lengthCm", "widthCm", "depthCm", "areaCm2", "lengthLine", "widthLine", "tissueTypes", "periWoundAppearance", "clinicalNotes", "accuracyConfidence"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  // Robust extraction to handle potential AI markdown wrappers
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleanJson = jsonMatch ? jsonMatch[0] : text;
  
  return JSON.parse(cleanJson);
};
