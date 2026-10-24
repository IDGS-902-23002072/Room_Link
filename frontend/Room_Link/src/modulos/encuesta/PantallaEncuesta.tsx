import { useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  guardarTestCompatibilidad,
  obtenerTestCompatibilidad,
  type DimensionCompatibilidad,
  type RespuestasCompatibilidad,
  type ResumenDimension,
} from '../compatibilidad/api';
import { BarraProgreso } from './componentes/BarraProgreso';
import { BotonPrincipal } from './componentes/BotonPrincipal';
import { MedidorResultado } from './componentes/MedidorResultado';
import { OpcionesPregunta } from './componentes/OpcionesPregunta';
import { preguntasConvivencia, preguntasHabitos } from './datos/preguntas';

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

type Step = 1 | 2 | 3;
type Answers = Partial<RespuestasCompatibilidad>;
const BORRADOR_KEY =
  `@roomlink/compatibility-test-draft:${process.env.EXPO_PUBLIC_USER_ID?.trim() || 'unconfigured'}`;

const dimensionNames: Record<DimensionCompatibilidad, string> = {
  schedule: 'Horarios',
  cleanliness: 'Limpieza',
  noise: 'Ruido',
  pets: 'Mascotas',
  smoking: 'Tabaco',
  visits: 'Visitas',
  genderPref: 'Preferencia de género',
};

const allQuestions = [...preguntasHabitos, ...preguntasConvivencia];
const compatibilityDimensions = allQuestions.map((question) => question.id);
const compatibilityDimensionSet = new Set<string>(compatibilityDimensions);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDraft(value: unknown): value is Answers {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([dimension, answer]) =>
      compatibilityDimensionSet.has(dimension) &&
      Number.isInteger(answer) &&
      Number(answer) >= 1 &&
      Number(answer) <= 5,
  );
}

function isCompleteAnswers(answers: Answers): answers is RespuestasCompatibilidad {
  return compatibilityDimensions.every(
    (dimension) =>
      Number.isInteger(answers[dimension]) &&
      Number(answers[dimension]) >= 1 &&
      Number(answers[dimension]) <= 5,
  );
}

function calculateSummary(answers: Answers): ResumenDimension[] {
  return allQuestions.flatMap(({ id }) => {
    const answer = answers[id];
    if (answer === undefined) return [];
    const percentage = Math.round(((answer - 1) / 4) * 100);
    return [
      {
        dimension: id,
        percentage,
        level: percentage <= 33 ? 'bajo' : percentage <= 66 ? 'medio' : 'alto',
      },
    ];
  });
}

export function PantallaEncuesta() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<ResumenDimension[] | null>(null);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 460);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(BORRADOR_KEY);
        if (stored) {
          try {
            const parsed: unknown = JSON.parse(stored);
            if (!isValidDraft(parsed)) {
              await AsyncStorage.removeItem(BORRADOR_KEY);
              throw new Error('El borrador local no tiene respuestas válidas y se eliminó.');
            }
            if (active) setAnswers(parsed);
          } catch (cause) {
            if (active) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'El borrador local estaba dañado y se eliminó.',
              );
            }
            await AsyncStorage.removeItem(BORRADOR_KEY);
          }
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo recuperar el borrador.');
        }
      }
      try {
        const result = await obtenerTestCompatibilidad();
        if (active && result.completed && result.answers) {
          setAnswers(result.answers);
          setSavedResult(result.summary);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'No se pudo consultar el test.',
          );
        }
      } finally {
        if (active) {
          setHydrated(true);
          setLoading(false);
        }
      }
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(BORRADOR_KEY, JSON.stringify(answers)).catch((cause: unknown) => {
      setError(
        cause instanceof Error
          ? `No se pudo guardar el borrador local: ${cause.message}`
          : 'No se pudo guardar el borrador local.',
      );
    });
  }, [answers, hydrated]);

  const setAnswer = (questionId: string, answer: string) => {
    const question = allQuestions.find(({ id }) => id === questionId);
    if (!question) return;
    const numericAnswer = question.options.indexOf(answer) + 1;
    if (numericAnswer < 1) return;
    setAnswers((current) => ({
      ...current,
      [question.id]: numericAnswer,
    }));
    setSavedResult(null);
    setError(null);
  };

  const continueToStep = (currentQuestions: typeof preguntasHabitos, next: Step) => {
    const unanswered = currentQuestions.some(({ id }) => answers[id] === undefined);
    if (unanswered) {
      setError('Responde todas las preguntas para continuar.');
      return;
    }
    setError(null);
    setStep(next);
  };

  const saveAndExplore = async () => {
    if (!isCompleteAnswers(answers)) {
      setError('Completa las siete respuestas antes de guardar el test.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await guardarTestCompatibilidad(answers);
      setSavedResult(result.summary);
      try {
        await AsyncStorage.removeItem(BORRADOR_KEY);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `El test se guardó, pero no se pudo eliminar el borrador: ${cause.message}`
            : 'El test se guardó, pero no se pudo eliminar el borrador local.',
        );
      }
      router.push('/explorar');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el test.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { width: contentWidth }]}
        showsVerticalScrollIndicator={false}>
        <Link href="/explorar" asChild>
          <Pressable accessibilityRole="button" style={styles.exitLink}>
            <Text style={styles.exitLinkText}>‹  Volver a descubrir</Text>
          </Pressable>
        </Link>
        <Text style={styles.brand}>ROOMLINK / 03</Text>

        {loading && <Text style={styles.subtitle}>Recuperando tus respuestas…</Text>}
        {step === 1 && (
          <>
            <Text style={styles.title}>Tu ritmo de vida</Text>
            <Text style={styles.subtitle}>Paso 1 de 2 · Hábitos cotidianos</Text>
            <BarraProgreso progreso={50} />
            <View style={styles.questions}>
              {preguntasHabitos.map((question) => (
                <OpcionesPregunta
                  key={question.id}
                  pregunta={question}
                  seleccionada={
                    answers[question.id] === undefined
                      ? ''
                      : question.options[(answers[question.id] ?? 1) - 1]
                  }
                  alSeleccionar={(answer) => setAnswer(question.id, answer)}
                />
              ))}
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>No hay respuestas perfectas</Text>
              <Text style={styles.noteText}>
                Tus hábitos nos ayudan a encontrar mejores conexiones.
              </Text>
            </View>
            <BotonPrincipal
              etiqueta="Continuar"
              alPresionar={() => continueToStep(preguntasHabitos, 2)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Convivir a tu manera</Text>
            <Text style={styles.subtitle}>
              Paso 2 de 2 · Preferencias de convivencia
            </Text>
            <BarraProgreso progreso={100} />
            <View style={styles.questions}>
              {preguntasConvivencia.map((question) => (
                <OpcionesPregunta
                  key={question.id}
                  pregunta={question}
                  seleccionada={
                    answers[question.id] === undefined
                      ? ''
                      : question.options[(answers[question.id] ?? 1) - 1]
                  }
                  alSeleccionar={(answer) => setAnswer(question.id, answer)}
                />
              ))}
            </View>
            <BotonPrincipal
              etiqueta="Ver mis resultados"
              alPresionar={() => continueToStep(preguntasConvivencia, 3)}
            />
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
              <Text style={styles.resultTitle}>Tu perfil de convivencia</Text>
              <Text style={styles.resultDescription}>
                Resumen basado en las respuestas de tu test.
              </Text>
            </View>
            <View style={styles.meters}>
              {(savedResult ?? calculateSummary(answers)).map((item) => (
                <MedidorResultado
                  key={item.dimension}
                  etiqueta={dimensionNames[item.dimension]}
                  valor={item.percentage}
                />
              ))}
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Tus afinidades principales</Text>
              <Text style={styles.noteText}>
                El motor comparará estas dimensiones con las de otros perfiles.
              </Text>
            </View>
            <BotonPrincipal
              etiqueta={saving ? 'Guardando…' : 'Guardar y encontrar roomies'}
              alPresionar={saveAndExplore}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(2)}
              style={styles.backButton}>
              <Text style={styles.backButtonText}>Editar respuestas</Text>
            </Pressable>
          </>
        )}
        {error && (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  exitLink: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
  },
  exitLinkText: {
    color: colors.plum,
    fontSize: 10,
    fontWeight: '600',
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
  error: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FCE8E8',
    marginTop: 10,
  },
  errorText: {
    color: '#8A3030',
    fontSize: 11,
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
