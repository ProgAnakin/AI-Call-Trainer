import type { UiLanguage } from '@/types';

export interface LegalSection {
  h: string;
  p: string[];
}
export interface LegalDoc {
  updated: string;
  privacy: LegalSection[];
  terms: LegalSection[];
}

/**
 * Conteúdo legal trilíngue — mantido fora do dicionário i18n (t()) porque são
 * parágrafos longos e estruturados. A página Legal renderiza pelo idioma da UI.
 * Linguagem simples e honesta; reflete a arquitetura real (dados locais por
 * padrão, sync opcional, IA só quando o backend está ligado).
 */
const UPDATED = '2026-07-28';

export const LEGAL: Record<UiLanguage, LegalDoc> = {
  pt: {
    updated: UPDATED,
    privacy: [
      {
        h: 'Resumo em uma linha',
        p: [
          'Por padrão, seus dados de treino ficam só no seu navegador. Não vendemos dados, não usamos rastreadores nem anúncios.',
        ],
      },
      {
        h: 'O que fica guardado e onde',
        p: [
          'Seu histórico de treino (sessões, notas, transcrições e cenários que você cria) é salvo localmente no seu navegador (localStorage). Nada disso vai para um servidor por padrão.',
          'Se você ativar a sincronização entre dispositivos (opcional), seu e-mail e um backup do seu histórico são guardados no Supabase, ligados ao seu e-mail, apenas para sincronizar seu progresso.',
        ],
      },
      {
        h: 'Processamento por IA',
        p: [
          'Quando o backend com Claude está ligado, a transcrição da sua call é enviada à Anthropic para gerar as falas do prospect e o scorecard. Pelos termos de API da Anthropic, esse conteúdo não é usado para treinar os modelos.',
          'No modo demo (sem backend), nada sai do seu dispositivo — o prospect e a avaliação são simulados localmente.',
          'O reconhecimento de voz, quando usado, é processado pelo seu navegador (serviço do Google no Chrome/Edge).',
        ],
      },
      {
        h: 'Seus direitos (LGPD / GDPR)',
        p: [
          'Acessar e exportar: você pode baixar tudo em JSON ou CSV na tela de Progresso.',
          'Apagar: limpe os dados do site no navegador, ou saia da conta e remova o backup na nuvem. Como o padrão é local, apagar os dados do navegador remove seu histórico.',
          'Você não precisa de conta para usar o app.',
        ],
      },
      {
        h: 'Contato',
        p: ['Dúvidas sobre privacidade? Abra uma issue no repositório do projeto no GitHub.'],
      },
    ],
    terms: [
      {
        h: 'Aceitação',
        p: ['Ao usar o AI Call Trainer você concorda com estes termos. Se não concordar, não use o app.'],
      },
      {
        h: 'O que é o serviço',
        p: [
          'É uma ferramenta gratuita de treino de vendas, de código aberto (licença MIT). As personas e empresas são fictícias — não são ligações reais nem representam pessoas reais.',
        ],
      },
      {
        h: 'Uso responsável',
        p: [
          'Não cole dados confidenciais de clientes reais nos cenários: quando o backend de IA está ligado, esse texto é enviado ao provedor de IA.',
          'Se você hospedar sua própria versão com sua chave de API, os custos dessa API são de sua responsabilidade.',
        ],
      },
      {
        h: 'Sem garantias',
        p: [
          'O app é fornecido "no estado em que se encontra", sem garantias. O feedback é para fins de treino e não substitui coaching profissional. Não nos responsabilizamos por decisões tomadas com base no uso da ferramenta.',
        ],
      },
      {
        h: 'Mudanças',
        p: ['Podemos atualizar estes termos. A data de atualização acima indica a versão vigente.'],
      },
    ],
  },
  it: {
    updated: UPDATED,
    privacy: [
      {
        h: 'Riassunto in una riga',
        p: [
          'Per impostazione predefinita i tuoi dati di allenamento restano solo nel tuo browser. Non vendiamo dati, non usiamo tracker né pubblicità.',
        ],
      },
      {
        h: 'Cosa viene salvato e dove',
        p: [
          'Il tuo storico di allenamento (sessioni, voti, trascrizioni e scenari che crei) è salvato localmente nel browser (localStorage). Per impostazione predefinita nulla va su un server.',
          'Se attivi la sincronizzazione tra dispositivi (opzionale), la tua email e un backup del tuo storico vengono salvati su Supabase, collegati alla tua email, solo per sincronizzare i progressi.',
        ],
      },
      {
        h: 'Elaborazione tramite IA',
        p: [
          'Quando il backend con Claude è attivo, la trascrizione della call viene inviata ad Anthropic per generare le battute del prospect e lo scorecard. Secondo i termini API di Anthropic, questi contenuti non vengono usati per addestrare i modelli.',
          'In modalità demo (senza backend) nulla lascia il tuo dispositivo: prospect e valutazione sono simulati localmente.',
          'Il riconoscimento vocale, quando usato, è elaborato dal tuo browser (servizio Google su Chrome/Edge).',
        ],
      },
      {
        h: 'I tuoi diritti (GDPR)',
        p: [
          'Accesso ed esportazione: puoi scaricare tutto in JSON o CSV nella schermata Progressi.',
          'Cancellazione: cancella i dati del sito nel browser, oppure esci dall’account e rimuovi il backup nel cloud. Poiché il default è locale, cancellare i dati del browser rimuove il tuo storico.',
          'Non serve un account per usare l’app.',
        ],
      },
      {
        h: 'Contatti',
        p: ['Domande sulla privacy? Apri una issue nel repository del progetto su GitHub.'],
      },
    ],
    terms: [
      {
        h: 'Accettazione',
        p: ['Usando AI Call Trainer accetti questi termini. Se non li accetti, non usare l’app.'],
      },
      {
        h: 'Cos’è il servizio',
        p: [
          'È uno strumento gratuito di allenamento alle vendite, open source (licenza MIT). Le persone e le aziende sono fittizie — non sono chiamate reali né rappresentano persone reali.',
        ],
      },
      {
        h: 'Uso responsabile',
        p: [
          'Non incollare dati riservati di clienti reali negli scenari: quando il backend IA è attivo, quel testo viene inviato al fornitore di IA.',
          'Se ospiti una tua versione con la tua chiave API, i costi di quell’API sono a tuo carico.',
        ],
      },
      {
        h: 'Nessuna garanzia',
        p: [
          'L’app è fornita "così com’è", senza garanzie. Il feedback ha scopo di allenamento e non sostituisce un coaching professionale. Non siamo responsabili per decisioni prese in base all’uso dello strumento.',
        ],
      },
      {
        h: 'Modifiche',
        p: ['Possiamo aggiornare questi termini. La data di aggiornamento in alto indica la versione vigente.'],
      },
    ],
  },
  en: {
    updated: UPDATED,
    privacy: [
      {
        h: 'One-line summary',
        p: [
          'By default your training data lives only in your browser. We don’t sell data, and there are no trackers or ads.',
        ],
      },
      {
        h: 'What is stored and where',
        p: [
          'Your training history (sessions, scores, transcripts and scenarios you create) is saved locally in your browser (localStorage). By default none of it goes to a server.',
          'If you turn on cross-device sync (optional), your email and a backup of your history are stored in Supabase, tied to your email, only to sync your progress.',
        ],
      },
      {
        h: 'AI processing',
        p: [
          'When the Claude backend is on, your call transcript is sent to Anthropic to generate the prospect’s lines and the scorecard. Under Anthropic’s API terms, that content is not used to train their models.',
          'In demo mode (no backend) nothing leaves your device — the prospect and the evaluation are simulated locally.',
          'Speech recognition, when used, is processed by your browser (Google’s service on Chrome/Edge).',
        ],
      },
      {
        h: 'Your rights (GDPR / LGPD)',
        p: [
          'Access and export: download everything as JSON or CSV on the Progress screen.',
          'Delete: clear the site’s data in your browser, or sign out and remove the cloud backup. Since the default is local, clearing browser data removes your history.',
          'You don’t need an account to use the app.',
        ],
      },
      {
        h: 'Contact',
        p: ['Privacy questions? Open an issue in the project’s GitHub repository.'],
      },
    ],
    terms: [
      {
        h: 'Acceptance',
        p: ['By using AI Call Trainer you agree to these terms. If you don’t agree, don’t use the app.'],
      },
      {
        h: 'What the service is',
        p: [
          'A free, open-source sales-training tool (MIT license). Personas and companies are fictional — these are not real calls and don’t represent real people.',
        ],
      },
      {
        h: 'Responsible use',
        p: [
          'Don’t paste real customers’ confidential data into scenarios: when the AI backend is on, that text is sent to the AI provider.',
          'If you self-host your own version with your API key, that API’s costs are your responsibility.',
        ],
      },
      {
        h: 'No warranty',
        p: [
          'The app is provided "as is", without warranties. Feedback is for training purposes and is not a substitute for professional coaching. We are not liable for decisions made based on using the tool.',
        ],
      },
      {
        h: 'Changes',
        p: ['We may update these terms. The updated date above marks the current version.'],
      },
    ],
  },
};
