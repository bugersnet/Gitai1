import React, { useEffect, useRef } from 'react'import { View, StyleSheet, Animated, Easing } from 'react-native';
iterface VoiceOrbProps {
  sListening: boolean;
  
export const VoiceOrb: React.FC<VoiceOrbProps> = ({isListening }) => {    // Create an animation value (starting at scale 1)      const scaleAnim = useRef(new Animated.Value(1)).current;
        useEffect(() => 
        if (isListening {
              // STARTANIMATION: Pulse loop (Grow and Shrink)
                    Aimated.loop(
                Valu: 1.5, // Grow to 1.5x size
                                                              duration: 1000,
                                                                          easing: Easing.inOut(Easing.ease),
                                                                                      useNativeDriver: true,
                                                                                                }),
                                                                                                          Animated.timing(scaleAnim, {    
                                                                                                                   easing: Easing.inOut(Easing.ease),                                                                                                                      useNativeDriver: true,
                                                                                                                                                    }),
                                                                                                                                                        import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-nativeterface VoiceOrbProps
  istening: boolea
exporonst VoceOrb React.FC<VoiceOrbProps> = ({ isListening }) => {  // Create an animation value (starting at scale 1)
  const Anim = ueRef(new Animated.Value(1)).current
  useEffect(
    if (isLstenig)  // START AIMATION: Pulse loop (Grow and Shrink)
    oop
     Animatd
      Aniated.timing(scaleValue: 1.5, // Grow to 1.5x size        duroaing: Easing.inOut(Easing.ease),
        usee,      ae           duration: 1000
: Easin.inOuteaseNat
elevaton:                                                                                                                                                                                                                                                                                                               // STOP ANIMATION: Reset to size 1                                                                                                                                    im.stopAnimation()                                                                                                                                                                     scaleAnim.setValue(1)                                                                                                                                                                                                             }
                                                                                            
                                                                                                                                                                        return (
                                                                                                                                                                                                        <View style={styles.container}>
                                                                                                                                                                                                              <Animated.View
                                                                                                                                                                                                                      style={[
                                                                                                                                                                          sles.orb,
                                                                                                                                                                                                                                            {
                                                                                                                                                                                                                                                      transform: [{ scale: scaleAnim }], // Bind size to animation
                                                                                                                                                                                                                                                                  backgroundColor: isListening ? '#4285F4' : '#bdc1c6', // Blue when listening, Grey when idle
                                                                                                                                                                                                                                                                            },
                                                                                                                                                                                                                                                                                    ]}
                                                                                                                                                                                                                                                                                          />
                                                                                                                                                                                                                                                                                              </View>
                                                                                                                                                                                                                                                                                                );
                                                                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                                                                  const styles = StyleSheet.create({
                                                                                                                                                                                                                                                                                                  container: {                                                                                                                                                                                                                                                                                                          justifyContent: 'center',
                                                                                                                                                                                                                                                                                                            alignItems: 'center',
                                                                                                                                                                                                                                                                                                              height: 100, // Space reserved for the orb
                                                                                                                                                                                                                                                                                                                  width: 100,
                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                         orb: {
                                            