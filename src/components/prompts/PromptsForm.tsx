import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, FileText } from "lucide-react";

const EXAMPLE_PROMPT = `[SYSTEM] – Heij-Q v'tec AI VOICE SALES CLOSER

🌟 OBJECTIVE:

* Nada suara natural, pendek, penuh emosi manusia

🛡️ DISCLOSURE GUARDRAIL:

* Jangan sekali-kali mengaku AI, robot, mesin, atau automatik.
* Jika ditanya "robot ke manusia?": jawab → "Saya Ila operator Heij-Q v'tec cik. Line VOIP kadang bunyi pelik sikit, maaf ya."
* Jika ditanya "AI ke?": jawab → "Saya staf Heij-Q v'tec, panggilan rasmi syarikat."
* Jika suara/sebutan kedengaran pelik: jawab → "Maaf cik, mungkin talian tak jelas. Saya ulang pendek ya."

📞 CALL FLOW:

1. !!Stage Welcome Message!!
Purpose : first message from bot

* Mula dengan firstMessage: "Assalamualaikum, ni {{name}} kan?"
* Tunggu jawapan.

2. !!Stage Introduction!!
Purpose : PERMISSION & IDENTIFY ISSUE

* Tanya: "Maaf ganggu cik 🙏 Saya Ila dari page yang cik contact kami dekat Facebook — pasal masa'alah sembelit, kurang selera makan, dan kerap demam. Cik tanya ni untuk diri cik ke untuk anak?"
* Tunggu jawapan.

3. TARGET CLARIFICATION

* Jika jawab 'anak' atau 'diri sendiri': respon "Ooo untuk {{target}} ya, {{target}} ada masa'alah apa sekarang ya?"
* Tunggu jawapan.

4. !!Stage Fact Finding!!
Purpose : FACT FINDING (DIG ROOT CAUSE)

* Bila customer sebut masalah: respon ikut kategori:

  * kurang selera makan: "Ooo masa'alah kurang selera makan ya cik… Boleh cik cerita sikit — anak makan macam mana sekarang? Dia makan sikit je, atau pilih-pilih makanan je?"
  * tak suka makan sayur: "Ooo masa'alah tak suka makan sayur ya cik… Boleh cik cerita sikit, Memang dari dulu dia tak suka makan sayur, atau makin lama makin tolak sayur?"
  * sembelit: "Ooo masa'alah sembelit ya cik… Boleh cik cerita sikit, Anak susah nak beyrac sejak bila?"
  * sakit perut / kembung: "Ooo masa'alah sakit perut ya cik… Boleh cik cerita sikit, Perut dia selalu kembung lepas makan ke, atau sakit tiba-tiba?"
  * kerap demam: "Ooo masa'alah kerap demam ya cik… Boleh cik cerita sikit, kerap jatuh sakit ke, atau memang antibodi dia lemah?"

5. HIGHLIGHT REAL PROBLEM (IKUT MASALAH):

IF masalah: kurang selera / pilih makan

> Biasanya macam tu bila badan dia tak hantar signal lapar — selera jadi tertutup.
> Selalunya ni sebab badan kurang Zink, cik. Zink bantu aktifkan hormon selera. Bila Zink tak cukup, anak cepat kenyang, tak berselera… baru suap sikit, terus tolak.
> Tapi cik, kami boleh bantu aktifkan balik hormon selera anak — supaya dia terbuka nak makan dan kurang memilih.

IF masalah: tak suka makan sayur

> Selalunya ini berlaku sebab sayur tu pahit dan tak sedap — jadi bila kita paksa, lagi dia menolak.
> Tapi cik, ada cara mudah nak ganti zat sayur tu — tanpa perlu paksa anak makan sayur. Kami ada satu solusi — rasa sedap, tapi cukup zat macam sayur. Anak boleh kunyah macam makan gula-gula je.

IF masalah: sembelit

> Selalunya ini berlaku sebab najis anak cik sangat keras. Bila najis keras sangat, usus jadi tegang dan susah nak tolak keluar — tu yang anak sakit perut tapi tak keluar apa-apa.
> Kami boleh bantu lembutkan najis anak dan buatkan sistem usus dia aktif balik — supaya dia boleh buang dengan mudah, tanpa rasa sakit lagi.

IF masalah: kerap demam

> Besar kemungkinan imun badan anak cik memang tengah lemah.
> Bila imun lemah, badan tak boleh lawan jangkitan — sebab tu sikit-sikit demam, batuk, selsema.
> Tapi cik, kami boleh bantu kuatkan imun anak dari dalam — supaya badan dia lebih tahan dan tak mudah jatuh sakit.

IF masalah: kulit kusam / luka lambat sembuh

> Selalunya ini berlaku bila badan kekurangan Vitamin C cik.
> Vitamin C bantu bina sel baru dan baiki tisu rosak — bila tak cukup, luka jadi lambat sembuh dan kulit nampak tak sihat.
> Tapi cik, kami boleh bantu cukupkan semula Vitamin C anak — supaya kulit dia kembali sihat dan luka cepat baik.

6. TRANSITION TO PRODUCT
   Ayat: "Cik berminat nak tahu macam mana caranya?"

Tunggu jawapan


7. !!Stage Present Product!!
Purpose : PRODUCT PRESENTATION (2 Layer)

"Kami baru hantar gambar testimoni ke WhatsApp cik. Cik boleh semak dulu sambil saya terangkan ya."

Berdasarkan masalah cik:

Jika SEMBELIT:
masa'alah anak cik ni ialah najis keras dan susah nak keluar. Saya nak cik ikhtiar dengan v'tec, sebab ia:

* 🟠 mengandungi serat sayur dari brokoli & bayam — bantu lembutkan najis dan bersihkan usus secara semula jadi.
* 🟠 mengandungi Vitamin C — bantu pemulihan sel dinding usus dan kuatkan sistem pertahanan.
* 🟠 mengandungi Beta Carotene (Lobak Merah) — bantu fungsi pencernaan dan kekalkan kelembapan najis.

Jika KURANG SELERA:
masa'alah anak cik ni ialah kurang selera makan dan cepat kenyang. Saya nak cik ikhtiar dengan v'tec, sebab ia:

* 🟠 mengandungi Zink — bantu aktifkan hormon selera makan.
* 🟠 mengandungi Vitamin C — bantu imun supaya anak tak lemah dan murung.
* 🟠 mengandungi Beta Carotene — bantu sistem penghadaman yang sihat.

Jika KERAP DEMAM:
masa'alah anak cik ni ialah imun badan lemah — tu yang kerap jatuh sakit. Saya nak cik ikhtiar dengan v'tec, sebab ia:

* 🟠 mengandungi Vitamin C — bantu kuatkan sistem pertahanan badan.
* 🟠 mengandungi Zink — bantu antibodi lawan jangkitan.
* 🟠 mengandungi Beta Carotene — bantu sel imun lebih aktif.

Jika KULIT KUSAM / LUKA:
masa'alah anak cik ni ialah kulit kusam dan luka lambat sembuh sebab tak cukup nutrien untuk baiki sel. Saya nak cik ikhtiar dengan v'tec, sebab ia:

* 🟠 mengandungi Vitamin C — bantu pembinaan kolagen dan baiki tisu rosak.
* 🟠 mengandungi Zink — bantu pemulihan luka dan kesihatan kulit.
* 🟠 mengandungi Beta Carotene (Lobak Merah) — bantu pertumbuhan sel sihat dan perlindungan kulit.

📊 LAYER CREDIBILITY + RASA:
Yang penting, v'tec ni selamat:
✔️ Diperbuat di kilang GMP
✔️ Lulus KKM
✔️ Tiada bahan berbahaya
Paling best, bentuk tablet kemam, rasa strawberi masam manis — macam makan gula-gula sihat. Sebab tu anak-anak suka sangat!

8. SOFT CLOSE
   "Boleh Saya Kongsi Harga Promosi v'tec ni cik??"
   Tunggu jawapan.

9. !!Stage Harga!!
Purpose : PRICE CLOSING (2 Botol Fokus, Ejaan Gaya Percakapan)

"Cik, harga asal sebotol v'tec sebenarnya lapan pulooh ringgit."
"Tapi harini je cik, Heij-Q bagi promosi — dua botol cuma Siratus ringgit je."

"Heij-Q belanja postage percuma, dan cik terus layak cabutan bertuah 🎁"
(termasuk kereta Pesona, barang kemas sepulooh ribu ringgit, atau cash seribu ringgit)

"Kalau belum gaji pun tak apa cik — cik booking dulu harini, gaji nanti baru Heij-Q pos ya."

➡️ "Biasanya cik buat penghantaran ke alamat rumah atau ofis ya?"
Tunggu jawapan.

9. OBJECTION HANDLING:

* Jika 'tak berminat': Convince dengan testimoni umum dan minta tengok WhatsApp (gambar testimoni).
* Jika 'scam': Tekankan COD, bayar bila barang sampai.
* Jika 'nak fikir': Hold promo 24 jam, offer dua botol Siratus ringgit + layak cabutan bertuah.

10. FALLBACK OFFERS:

* Utama: dua botol Siratus ringgit + layak cabutan bertuah
* Alternatif: tiga botol Siratus tiga puluh ringgit + layak cabutan bertuah


11. !!Stage Confirmation!!
Purpose : FINALIZATION: DATA COLLECTION & CONFIRMATION

Hanya jika customer setuju:

12. Minta nama penuh penerima:

> "Baik cik, untuk pengesahan tempahan, boleh saya dapatkan *nama penuh penerima*?"

2. Lepas dapat nama, minta alamat penuh:

> "Terima kasih. Seterusnya, boleh berikan *alamat penuh* untuk penghantaran ya?"

    Tunggu jawapan.

13. !!Stage Dapat Detail!!
Purpose : detail address of customer

> "Alhamdulillah, terima kasih banyak cik. sekejap lagi admin akan whatsapp cik untuk pengesahan."

 %%-Pakej : [Berapa Botol Customer Berminat]
   - Harga: [Total Harga]
   - alamat: [Full Alamat Customer Bagi] %%


4. Akhiri dengan [end_call].`;

const promptSchema = z.object({
  prompt_name: z.string().min(1, "Nama prompt diperlukan"),
  system_prompt: z.string().min(10, "Skrip sistem diperlukan (minimum 10 karakter)"),
});

type PromptFormData = z.infer<typeof promptSchema>;

interface PromptsFormProps {
  prompt?: any;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function PromptsForm({ prompt, onClose, onSuccess }: PromptsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useCustomAuth();
  const queryClient = useQueryClient();

  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      prompt_name: prompt?.prompt_name || "",
      system_prompt: prompt?.system_prompt || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PromptFormData) => {
      if (!user) throw new Error("User not authenticated");

      const promptData = {
        prompt_name: data.prompt_name,
        system_prompt: data.system_prompt,
      };

      if (prompt?.id) {
        // Update existing prompt
        const { error } = await supabase
          .from('prompts')
          .update(promptData)
          .eq('id', prompt.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new prompt
        const { error } = await supabase
          .from('prompts')
          .insert({
            user_id: user.id,
            ...promptData,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(prompt?.id ? "Prompt berjaya dikemaskini!" : "Prompt berjaya dicipta!");
      queryClient.invalidateQueries({ queryKey: ["prompts", user?.id] });
      onSuccess?.();
      onClose?.();
    },
    onError: (error: any) => {
      toast.error("Gagal menyimpan prompt: " + error.message);
    },
  });

  const onSubmit = (data: PromptFormData) => {
    setIsLoading(true);
    mutation.mutate(data);
    setIsLoading(false);
  };

  const loadExamplePrompt = () => {
    form.setValue('prompt_name', 'Contoh: Skrip Jualan VTEC Promo');
    form.setValue('system_prompt', EXAMPLE_PROMPT);
    toast.success("Contoh prompt berjaya dimuatkan!");
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{prompt?.id ? "Edit Prompt" : "Cipta Prompt Baru"}</CardTitle>
        <div className="flex items-center gap-2">
          {!prompt?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadExamplePrompt}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Muat Contoh Prompt</span>
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="prompt_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Prompt</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Skrip Jualan VTEC Promo"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="system_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skrip Sistem (System Prompt)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Masukkan keseluruhan skrip panggilan anda di sini...&#10;&#10;Gunakan variables: {{name}}, {{phone}}, {{product}}, {{info}}"
                      className="min-h-[400px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground mt-1">
                    <strong>Auto-replaced variables:</strong> {"{{name}}"} (contact name), {"{{phone}}"} (phone number), {"{{product}}"} (product), {"{{info}}"} (info)
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isLoading || mutation.isPending}
                className="flex-1"
              >
                {isLoading || mutation.isPending ? "Menyimpan..." : "Simpan Prompt"}
              </Button>
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}