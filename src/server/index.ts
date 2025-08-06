import { publicProcedure, router } from "./trpc";
import z from "zod";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase/server";
export const appRouter = router({
  askGemini: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    const ai = new GoogleGenAI({
      apiKey: "AIzaSyD6Sd4Nnt9cdFxzBAqohL8qVPsMca_IwIQ",
    });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: input,
    });
    return { text: response.text };
  }),

  createConversation: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        title: z.string().default("New Chat"),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert([
          {
            user_id: input.userId,
            title: input.title,
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      return data;
    }),

  getConversation: publicProcedure
    .input(z.string())
    .query(async ({ input: user_id }) => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*,messages(*)")
        .eq("user_id", user_id)
        .order("last_updated", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  insertMessage: publicProcedure
    .input(
      z.object({
        conversation_id: z.string(),
        user_id: z.string(),
        content: z.string(),
        role: z.enum(["user", "assistant"]),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: input.conversation_id,
            user_id: input.user_id,
            content: input.content,
            role: input.role,
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      return data;
    }),

  updateConversation: publicProcedure
    .input(
      z.object({
        conversation_id: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("conversations")
        .update({ title: input.title })
        .eq("id", input.conversation_id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return data;
    }),
});

export type AppRouter = typeof appRouter;
