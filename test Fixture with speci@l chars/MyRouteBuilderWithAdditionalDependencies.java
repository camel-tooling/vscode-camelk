// camel-k: dependency=mvn:org.apache.commons:commons-math3:3.6.1

import org.apache.camel.builder.RouteBuilder;
import org.apache.commons.math3.util.ArithmeticUtils;

public class MyRouteBuilderWithAdditionalDependencies extends RouteBuilder{
	public void configure() {
        ArithmeticUtils dummy;
    }
}
