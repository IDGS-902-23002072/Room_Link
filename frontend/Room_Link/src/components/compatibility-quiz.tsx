import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  background: '#FBF9FC',
  ink: '#28232D',
  muted: '#817987',
  plum: '#84658D',
  palePlum: '#E9DAEC',
  line: '#E9E2EB',
  teal: '#9BDFDA',
  white: '#FFFFFF',
};

const lifestyleQuestions = [
  {
    id: 'wake-up',
    prompt: '¿Cuándo empieza tu día?',
    options: ['Temprano', 'Más tarde', 'Variable'],
    initial: 'Temprano',
  },
  {
    id: 'tidiness',
    prompt: '¿Qué tan ordenado eres?',
    options: ['Muy ordenado', 'Flexible', 'Relajado'],
    initial: 'Muy ordenado',
  },
  {
    id: 'atmosphere',
    prompt: '¿Qué ambiente prefieres?',
    options: ['Tranquilo', 'Con música', 'Social'],
    initial: 'Tranquilo',
  },
] as const;

const homeQuestions = [
  {
    id: 'pets',
    prompt: '¿Vivirías con mascotas?',
    options: ['Sí', 'No', 'Depende'],
    initial: 'Sí',
  },
  {
    id: 'smoking',
    prompt: '¿Cómo te sientes con el tabaco?',
    options: ['Sin humo', 'Exterior', 'Sin problema'],
    initial: 'Sin humo',
  },
  {
    id: 'roommates',
    prompt: '¿Con quién prefieres compartir?',
    options: ['Cualquier género', 'Mujeres', 'Hombres'],
    initial: 'Cualquier género',
  },
  {
    id: 'visits',
    prompt: '¿Qué visitas te resultan cómodas?',
    options: ['Ocasionales', 'Frecuentes', 'Acordadas'],
    initial: 'Ocasionales',
  },
] as const;

type Step = 1 | 2 | 3;
type Answers = Record<string, string>;

const initialAnswers: Answers = Object.fromEntries(
  [...lifestyleQuestions, ...homeQuestions].map((question) => [
    question.id,
    question.initial,
  ]),
);

type Question = {
  id: string;
  prompt: string;
  options: readonly string[];
};

function QuestionChoices({
  question,
  selected,
  onSelect,
}: {
  question: Question;
  selected: string;
  onSelect: (answer: string) => void;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionPrompt}>{question.prompt}</Text>
      <View style={styles.options}>
        {question.options.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={option}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}>
              <Text
                numberOfLines={1}
                style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View
      accessibilityLabel={`Progreso: ${progress}%`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: progress }}
      style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${progress}%` }]} />
    </View>
  );
}

function ResultMeter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meter}>
      <View style={styles.meterLabelRow}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>{value}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

export function CompatibilityQuiz() {
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [profileReady, setProfileReady] = useState(false);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 460);

  const setAnswer = (questionId: string, answer: string) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { width: contentWidth }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>ROOMLINK / 03</Text>

        {step === 1 && (
          <>
            <Text style={styles.title}>Tu ritmo de vida</Text>
            <Text style={styles.subtitle}>Paso 1 de 2 · Hábitos cotidianos</Text>
            <ProgressBar progress={50} />
            <View style={styles.questions}>
              {lifestyleQuestions.map((question) => (
                <QuestionChoices
                  key={question.id}
                  question={question}
                  selected={answers[question.id]}
                  onSelect={(answer) => setAnswer(question.id, answer)}
                />
              ))}
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>No hay respuestas perfectas</Text>
              <Text style={styles.noteText}>
                Tus hábitos nos ayudan a encontrar mejores conexiones.
              </Text>
            </View>
            <PrimaryButton label="Continuar" onPress={() => setStep(2)} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Convivir a tu manera</Text>
            <Text style={styles.subtitle}>
              Paso 2 de 2 · Preferencias de convivencia
            </Text>
            <ProgressBar progress={100} />
            <View style={styles.questions}>
              {homeQuestions.map((question) => (
                <QuestionChoices
                  key={question.id}
                  question={question}
                  selected={answers[question.id]}
                  onSelect={(answer) => setAnswer(question.id, answer)}
                />
              ))}
            </View>
            <PrimaryButton label="Ver mis resultados" onPress={() => setStep(3)} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(1)}
              style={styles.backButton}>
              <Text style={styles.backButtonText}>Volver</Text>
            </Pressable>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Tu estilo de convivencia</Text>
            <Text style={styles.subtitle}>
              Este es tu punto de partida para conectar.
            </Text>
            <View style={styles.resultCard}>
              <Text style={styles.resultEyebrow}>Tu estilo</Text>
              <Text style={styles.resultTitle}>Equilibrado</Text>
              <Text style={styles.resultDescription}>
                Orden, tranquilidad y respeto por el espacio personal.
              </Text>
            </View>
            <View style={styles.meters}>
              <ResultMeter label="Limpieza" value={90} />
              <ResultMeter label="Horarios regulares" value={80} />
              <ResultMeter label="Vida social" value={55} />
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Tus afinidades principales</Text>
              <Text style={styles.noteText}>
                Personas sin humo, con mascotas o con horarios similares.
              </Text>
            </View>
            {profileReady && (
              <View accessibilityRole="alert" style={styles.confirmation}>
                <Text style={styles.confirmationText}>
                  ¡Listo! Guardamos tus preferencias de convivencia.
                </Text>
              </View>
            )}
            <PrimaryButton
              label="Encontrar roomies"
              onPress={() => setProfileReady(true)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(2)}
              style={styles.backButton}>
              <Text style={styles.backButtonText}>Editar respuestas</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  brand: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    backgroundColor: colors.line,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#63C8C2',
    borderRadius: 2,
  },
  questions: {
    gap: 10,
  },
  question: {
    gap: 6,
  },
  questionPrompt: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  option: {
    minHeight: 32,
    flexGrow: 1,
    flexBasis: '28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#F1EDF2',
  },
  optionSelected: {
    backgroundColor: colors.palePlum,
    borderColor: colors.palePlum,
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionText: {
    color: '#625D66',
    fontSize: 10,
  },
  optionTextSelected: {
    color: colors.plum,
    fontWeight: '600',
  },
  noteCard: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: colors.teal,
    marginTop: 13,
  },
  noteTitle: {
    color: '#25363A',
    fontSize: 13,
    fontWeight: '700',
  },
  noteText: {
    color: '#34474A',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: colors.plum,
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  backButton: {
    alignItems: 'center',
    padding: 10,
  },
  backButtonText: {
    color: colors.plum,
    fontSize: 11,
    fontWeight: '600',
  },
  confirmation: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.palePlum,
    marginTop: 10,
  },
  confirmationText: {
    color: colors.plum,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultCard: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.teal,
    marginTop: 16,
  },
  resultEyebrow: {
    color: '#3B6969',
    fontSize: 10,
  },
  resultTitle: {
    color: '#263C3F',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 1,
  },
  resultDescription: {
    color: '#3B5558',
    fontSize: 10,
    marginTop: 3,
  },
  meters: {
    gap: 12,
    marginTop: 14,
  },
  meter: {
    gap: 5,
  },
  meterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterLabel: {
    color: colors.ink,
    fontSize: 11,
  },
  meterValue: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '600',
  },
  meterTrack: {
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#63C8C2',
  },
});
