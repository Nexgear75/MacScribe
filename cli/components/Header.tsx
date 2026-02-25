import React from 'react'
import BigText from "ink-big-text";
import Gradient from "ink-gradient";

export function Header() {
	return (
		<Gradient colors={['#4995E3', '#C3677F']} >
			<BigText text="macscribe" font='block' align='left' />
		</Gradient >
	)
}

