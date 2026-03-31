
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, DefectType, Severity, RoadHealth } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const ROAD_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description: "Nosozlik turi: 'Chuqur (Pothole)', 'Yoriq (Crack)', 'To'siq (Obstacle)', 'O'chgan chiziqlar', 'Tekis yo'l' yoki 'Noma'lum'",
    },
    severity: {
      type: Type.STRING,
      description: "Xavflilik darajasi: 'Past', 'O'rtacha', 'Yuqori' yoki 'Yo'q'",
    },
    health: {
      type: Type.STRING,
      description: "Yo'lning umumiy holati: 'A'lo', 'Yaxshi', 'Qoniqarsiz', 'Yomon'",
    },
    description: {
      type: Type.STRING,
      description: "Yo'l holati haqida qisqa va aniq o'zbekcha tavsif.",
    },
    recommendation: {
      type: Type.STRING,
      description: "Harakat xavfsizligi bo'yicha amaliy tavsiya.",
    },
    estimatedCost: {
      type: Type.NUMBER,
      description: "Ushbu nosozlikni tuzatish uchun tahminiy xarajat (UZS - so'mda). Faqat raqam.",
    },
    estimatedTime: {
      type: Type.STRING,
      description: "Ushbu nosozlikni tuzatish uchun ketadigan tahminiy vaqt (masalan: '3 soat', '2 kun').",
    },
    estimatedArea: {
      type: Type.NUMBER,
      description: "Nosozlikning tahminiy maydoni (kvadrat metrda). Faqat raqam.",
    },
    materials: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Material nomi (masalan: Asfalt-beton, Bitum, Mastika)" },
          amount: { type: Type.STRING, description: "Miqdori (masalan: '2 tonna', '50 kg')" },
          unit: { type: Type.STRING, description: "O'lchov birligi (kg, tonna, l)" },
          cost: { type: Type.NUMBER, description: "Ushbu materialning tahminiy narxi (so'mda)" },
        },
        required: ["name", "amount", "unit", "cost"],
      },
      description: "Ta'mirlash uchun kerakli materiallar ro'yxati.",
    },
    boundingBox: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.NUMBER, description: "X koordinatasi (0-1000)" },
        y: { type: Type.NUMBER, description: "Y koordinatasi (0-1000)" },
        width: { type: Type.NUMBER, description: "Kengligi (0-1000)" },
        height: { type: Type.NUMBER, description: "Balandligi (0-1000)" },
      },
      required: ["x", "y", "width", "height"],
      description: "Nosozlikning tasvirdagi joylashuvi (bounding box).",
    },
    trafficLight: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN, description: "Svetofor aniqlanganmi?" },
        state: { type: Type.STRING, description: "Svetofor holati: 'red', 'green', 'yellow' yoki 'none'" },
        distance: { type: Type.NUMBER, description: "Svetoforgacha bo'lgan tahminiy masofa (metrda)." },
      },
      required: ["detected", "state"],
    },
  },
  required: ["type", "severity", "health", "description", "recommendation", "estimatedCost", "estimatedTime", "estimatedArea", "trafficLight"],
};

async function retry<T>(fn: () => Promise<T>, maxRetries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (maxRetries > 0 && isQuotaError) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, maxRetries - 1, delay * 2);
    }
    throw error;
  }
}

export async function analyzeRoadIssue(
  image: string,
  mode: 'live' | 'manual' = 'manual'
): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `Siz yo'l xavfsizligi va infratuzilmasi bo'yicha ilg'or AI mutaxassissiz. 
    Tasvirni tahlil qiling va yo'lning holatini aniqlang. 
    Agar yo'l yaxshi bo'lsa, buni 'Yaxshi' yoki 'A'lo' deb belgilang. 
    Agar nosozliklar (chuqur, yoriq) bo'lsa, ularni aniqlab, 'Yomon' yoki 'Qoniqarsiz' deb baholang.
    Shuningdek, ushbu nosozlikni bartaraf etish uchun tahminiy xarajatni (so'mda), vaqtni va maydonni (kv.m) hisoblang.
    Kerakli materiallar ro'yxatini (asfalt, bitum, texnika kuchi va h.k.) va ularning narxini ham bering.
    Tasvirdagi nosozlikning joylashuvini (bounding box) x, y, width, height formatida (0-1000 oralig'ida) aniqlang.
    MUHIM: Tasvirda svetofor bor-yo'qligini va uning holatini (qizil, yashil, sariq) aniqlang. 
    Agar svetofor qizil bo'lsa, buni aniq ko'rsating.
    Barcha javoblar o'zbek tilida bo'lishi shart.`;

  const contents = [
    {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: image.split(",")[1],
          },
        },
        { text: "Ushbu yo'l tasvirini tahlil qiling. Yo'l yaxshimi yoki nosoz? Svetofor bormi? Holatni va tavsiyalarni bering." },
      ],
    },
  ];

  return retry(async () => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: ROAD_ANALYSIS_SCHEMA,
        },
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        type: result.type as DefectType,
        severity: result.severity as Severity,
        health: result.health as RoadHealth,
        description: result.description,
        recommendation: result.recommendation,
        estimatedCost: result.estimatedCost,
        estimatedTime: result.estimatedTime,
        estimatedArea: result.estimatedArea,
        materials: result.materials,
        boundingBox: result.boundingBox,
        trafficLight: result.trafficLight,
      };
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      if (error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429')) {
        throw new Error("QUOTA_EXHAUSTED");
      }
      throw new Error("Tahlil xatosi.");
    }
  });
}
