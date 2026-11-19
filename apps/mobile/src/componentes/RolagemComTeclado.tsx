import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  TextInput,
  View,
} from 'react-native';

const FOLGA = 24;

/**
 * ScrollView que não deixa o teclado cobrir o campo digitado.
 *
 * No Android em tela cheia (edge-to-edge) a janela não encolhe quando o teclado
 * abre. Aqui reservamos no fim da rolagem um espaço do tamanho do teclado e
 * rolamos até o campo em foco ficar logo acima dele.
 */
export const RolagemComTeclado = forwardRef<ScrollViewInstance, ScrollViewProps>(function RolagemComTeclado(
  { children, onScroll, ...props },
  ref,
) {
  const interno = useRef<ScrollViewInstance>(null);
  useImperativeHandle(ref, () => interno.current as ScrollViewInstance);
  const [teclado, setTeclado] = useState(0);
  const deslocamento = useRef(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const mostrar = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setTeclado(e.endCoordinates.height);
      const topoTeclado = e.endCoordinates.screenY;
      // Espera o espaço reservado entrar no layout antes de rolar.
      setTimeout(() => {
        const campo = TextInput.State.currentlyFocusedInput() as { measureInWindow?: Function } | null;
        campo?.measureInWindow?.((_x: number, y: number, _l: number, altura: number) => {
          const excesso = y + altura + FOLGA - topoTeclado;
          if (excesso > 0) interno.current?.scrollTo({ y: deslocamento.current + excesso, animated: true });
        });
      }, ios ? 0 : 60);
    });
    const esconder = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={interno}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        deslocamento.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      {...props}
    >
      {children}
      {teclado > 0 && <View style={{ height: teclado }} />}
    </ScrollView>
  );
});
