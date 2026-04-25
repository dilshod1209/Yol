
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, DefectType } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const ROAD_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description: "Nosozlik turi: 'Chuqur (Pothole)', 'Yoriq (Crack)', 'G'ildirak izi (Rutting)', 'Emirilish', 'To'siq (Obstacle)', 'O'chgan chiziqlar', 'Yoritish nosozligi', 'Drenaj muammosi', 'Piyodalar yo'lagi nosozligi', 'Ko'kalamzor/Chang muammosi' yoki 'Tekis yo'l'",
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
      description: "Yo'l holati haqida batafsil va aniq o'zbekcha tavsif.",
    },
    recommendation: {
      type: Type.STRING,
      description: "Harakat xavfsizligi va ta'mirlash bo'yicha amaliy tavsiya.",
    },
    infrastructure: {
      type: Type.OBJECT,
      properties: {
        lightingFunctional: { type: Type.BOOLEAN, description: "Yoritish tizimi ishlayaptimi?" },
        drainageClear: { type: Type.BOOLEAN, description: "Drenaj/ariqlar toza va ochiqmi?" },
        markingsVisible: { type: Type.BOOLEAN, description: "Yo'l chiziqlari aniq ko'rinyaptimi?" },
        pedestrianSafety: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Piyodalar xavfsizligi darajasi" },
        vegetationHealth: { type: Type.STRING, enum: ['good', 'average', 'poor'], description: "Atrofdagi daraxtlar va ko'kalamzor holati" },
        dustLevel: { type: Type.STRING, enum: ['low', 'moderate', 'high'], description: "Havodagi chang/qum darajasi" }
      },
      required: ["lightingFunctional", "drainageClear", "markingsVisible", "pedestrianSafety"]
    },
    predictiveData: {
      type: Type.OBJECT,
      properties: {
        deteriorationRisk: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
        monthsToFailure: { type: Type.NUMBER, description: "Yo'lning jiddiy buzilishigacha qolgan taxminiy oylar soni" },
        recommendedMaintenanceDate: { type: Type.NUMBER, description: "Tavsiya etilgan ta'mirlash vaqti (timestamp)" }
      },
      required: ["deteriorationRisk", "monthsToFailure"]
    },
    estimatedCost: {
      type: Type.NUMBER,
      description: "Ushbu nosozlikni bartaraf etish uchun taxminiy xarajat (UZS).",
    },
    estimatedTime: {
      type: Type.STRING,
      description: "Taxminiy ta'mirlash vaqti.",
    },
    boundingBox: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
        width: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
      },
      required: ["x", "y", "width", "height"],
    }
  },
  required: ["type", "severity", "health", "description", "recommendation", "infrastructure", "predictiveData"],
};

export async function analyzeRoadIssue(
  image: string,
  mode: 'live' | 'manual' = 'manual'
): Promise<AnalysisResult> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing in the environment");
    throw new Error("API kaliti topilmadi.");
  }

  try {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `Siz yo'l infratuzilmasi, drenaj tizimlari va shahar logistikasi bo'yicha ilg'or AI tahlilchisisiz. 
      Tasvirni quyidagi mezonlar asosida tahlil qiling:
      1. Yo'l qoplami: Faqat chuqurlar emas, balki g'ildirak izlari (rutting), emirilish va yuzadagi mikro-yoriqlarni ham aniqlang.
      2. Yo'l belgilari: Eskirgan, bo'yog'i o'chgan yoki ko'rinmaydigan belgilarni inventarizatsiya qiling.
      3. Yoritish: Chiroq ustunларини va ularning holatini baholang (kechki tasvirlar uchun).
      4. Drenaj: Ariqlar va yomg'ir suvi tizimlarining to'lib qolganligini tekshiring.
      5. Xavfsizlik: Piyodalar o'tish yo'laklari va velosiped yo'llari uzviyligini baholang.
      6. Ekologiya: Daraxtlar holati va chang bosish darajasini (Orolbo'yi hududi xususiyatlari) hisobga oling.
      7. Prognoz: Mavjud holatdan kelib chiqib, yo'l qachon ta'mirga muhtoj bo'lishini (Predictive Maintenance) taxmin qiling.
      
      MUHIM: Barcha tavsiyalar o'zbek tilida bo'lishi shart.`;

    const imageParts = {
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(",")[1] || image,
      },
    };

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            imageParts,
            { text: "Ushbu yo'l tasvirini tahlil qiling. Yo'l yaxshimi yoki nosoz? Svetofor bormi? Holatni va tavsiyalarni bering." },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ROAD_ANALYSIS_SCHEMA,
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Type checking for enums
    if (!Object.values(DefectType).includes(result.type)) {
       // Map to closest if possible or default
    }

    return result as AnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    if (error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429')) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    throw new Error("Tahlil xatosi.");
  }
}
